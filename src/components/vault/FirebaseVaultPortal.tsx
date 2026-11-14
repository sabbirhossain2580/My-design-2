// src/components/vault/FirebaseVaultPortal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Info,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useFirebaseVault } from '../../context/FirebaseVaultContext.tsx';
import { db, handleFirestoreError, OperationType, storage } from '../../lib/firebase.ts';

interface UploadRecord {
  id: string;
  uploaderUid: string;
  uploaderEmail: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  description: string;
  createdAt?: any;
}

interface FirebaseVaultPortalProps {
  initialRoute?: 'home' | 'admin';
  onExitStandalone?: () => void;
  onRouteChange?: (route: 'home' | 'admin') => void;
}

export const FirebaseVaultPortal: React.FC<FirebaseVaultPortalProps> = ({
  initialRoute = 'home',
  onExitStandalone,
  onRouteChange,
}) => {
  const {
    firebaseUser,
    profile,
    authReady,
    isAdmin,
    signInWithEmail,
    signUpWithEmail,
    signOutVault,
  } = useFirebaseVault();

  // Route state synchronized with /admin path
  const [route, setRoute] = useState<'home' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return 'admin';
    }
    return initialRoute;
  });
  const [accessDeniedNotice, setAccessDeniedNotice] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Upload form state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Admin uploads list state (ONLY queried/populated when isAdmin === true)
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setRoute(initialRoute);
  }, [initialRoute]);

  const navigateTo = (target: 'home' | 'admin') => {
    if (target === 'admin' && firebaseUser && authReady && !isAdmin) {
      setAccessDeniedNotice(true);
      setRoute('home');
      onRouteChange?.('home');
      if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
        window.history.replaceState({}, '', '/');
      }
      return;
    }
    setAccessDeniedNotice(false);
    setRoute(target);
    onRouteChange?.(target);
    if (typeof window !== 'undefined') {
      const desiredPath = target === 'admin' ? '/admin' : '/';
      if (window.location.pathname !== desiredPath) {
        window.history.pushState({}, '', desiredPath);
      }
    }
  };

  // Enforce strict /admin redirect & Access Denied when non-admin hits /admin
  useEffect(() => {
    if (!authReady) return;
    if (route === 'admin' && firebaseUser && profile && !isAdmin) {
      setAccessDeniedNotice(true);
      setRoute('home');
      onRouteChange?.('home');
      if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [authReady, firebaseUser, profile, isAdmin, route, onRouteChange]);

  // Listen to browser back/forward on /admin
  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname === '/admin') {
        if (firebaseUser && !isAdmin) {
          setAccessDeniedNotice(true);
          setRoute('home');
          window.history.replaceState({}, '', '/');
        } else {
          setRoute('admin');
        }
      } else {
        setRoute('home');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [firebaseUser, isAdmin]);

  // Admin-only real-time listener on uploads collection
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin || route !== 'admin') {
      setUploads([]);
      return;
    }

    setAdminLoading(true);
    setAdminError('');
    const uploadsQuery = query(collection(db, 'uploads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      uploadsQuery,
      (snapshot) => {
        const rows: UploadRecord[] = snapshot.docs.map((d) => {
          const data = d.data() as UploadRecord;
          return {
            id: data.id || d.id,
            uploaderUid: data.uploaderUid,
            uploaderEmail: data.uploaderEmail,
            fileName: data.fileName,
            fileUrl: data.fileUrl,
            storagePath: data.storagePath,
            description: data.description,
            createdAt: data.createdAt,
          };
        });
        setUploads(rows);
        setAdminLoading(false);
      },
      (err) => {
        setAdminLoading(false);
        setAdminError('Unable to load submissions. Ensure your account has role = "admin" in Firestore.');
        try {
          handleFirestoreError(err, OperationType.LIST, 'uploads');
        } catch (wrapped) {
          console.error(wrapped);
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser, isAdmin, route]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setPassword('');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Email/Password sign-in is not enabled yet in Firebase Console → Authentication → Sign-in method.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Please sign in instead.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setAuthError('Invalid email or password. Please verify your credentials.');
      } else if (code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters.');
      } else {
        setAuthError(err?.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const trimmedDesc = description.trim();
    if (!selectedFile && !trimmedDesc) {
      setUploadError('Please choose a file to upload or enter text data in the description.');
      return;
    }

    if (trimmedDesc.length > 2000) {
      setUploadError('Description cannot exceed 2000 characters.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);
    setUploadProgress(null);

    const docId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      let fileUrl = '';
      let storagePath = '';
      let fileName = 'Text Submission';

      if (selectedFile) {
        const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
        fileName = selectedFile.name.slice(0, 255);
        storagePath = `uploads/${firebaseUser.uid}/${docId}_${sanitizedName}`;
        const fileRef = storageRef(storage, storagePath);

        fileUrl = await new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(fileRef, selectedFile);
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(pct);
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      }

      const payload: Record<string, any> = {
        id: docId,
        uploaderUid: firebaseUser.uid,
        uploaderEmail: firebaseUser.email || '',
        fileName,
        fileUrl: fileUrl.slice(0, 2048),
        description: trimmedDesc,
        createdAt: serverTimestamp(),
      };
      if (storagePath) {
        payload.storagePath = storagePath.slice(0, 512);
      }

      try {
        await setDoc(doc(db, 'uploads', docId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `uploads/${docId}`);
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setDescription('');
      setUploadProgress(null);
      setUploadSuccess(true);
    } catch (err: any) {
      setUploadError(err?.message || 'Submission failed. Verify Firebase Storage and Firestore permissions.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRecord = async (record: UploadRecord) => {
    if (!isAdmin) return;
    setDeletingId(record.id);
    try {
      if (record.storagePath) {
        try {
          await deleteObject(storageRef(storage, record.storagePath));
        } catch (storageErr) {
          console.warn('Storage file cleanup note:', storageErr);
        }
      }
      try {
        await deleteDoc(doc(db, 'uploads', record.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `uploads/${record.id}`);
      }
    } catch (err: any) {
      setAdminError(err?.message || 'Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimestamp = (ts: any): string => {
    if (!ts) return 'Just now';
    try {
      const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
      return date.toLocaleString();
    } catch {
      return '—';
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">Connecting to Firebase Secure Vault...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      {/* Top Vault Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Secure Document &amp; Data Vault
              </h1>
              {firebaseUser && isAdmin && (
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {firebaseUser
                ? `Signed in as ${firebaseUser.email}`
                : 'Firebase Authentication, Firestore & Storage · Strict Zero-Visibility RBAC'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onExitStandalone && (
            <button
              type="button"
              onClick={onExitStandalone}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>HR Portal</span>
            </button>
          )}

          {firebaseUser && (
            <>
              <button
                type="button"
                onClick={() => navigateTo('home')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  route === 'home'
                    ? 'bg-slate-900 text-white dark:bg-indigo-600'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Submit Data
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigateTo('admin')}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    route === 'admin'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Dashboard (/admin)</span>
                </button>
              )}

              <button
                type="button"
                onClick={signOutVault}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Access Denied Alert if Non-Admin tried accessing /admin */}
      {accessDeniedNotice && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-start space-x-3 text-xs text-red-800 dark:text-red-200">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-extrabold text-sm">Access Denied</div>
            <p className="mt-0.5">
              The <code>/admin</code> dashboard is restricted strictly to administrators. You have been redirected to your submission page.
            </p>
          </div>
        </div>
      )}

      {/* ANONYMOUS VISITOR: Email/Password Login & Signup Gate ONLY */}
      {!firebaseUser ? (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`flex-1 py-2 rounded-lg transition ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Create Account
              </button>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-6 space-y-4 text-xs">
            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 transition disabled:opacity-60"
            >
              {authMode === 'signup' ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'signup'
                  ? 'Sign Up (Default Role: User)'
                  : 'Sign In'}
              </span>
            </button>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-500" />
                <span>Admin Setup Note</span>
              </div>
              <p>
                New accounts are created with <code>role = &quot;user&quot;</code> in Firestore <code>users/&#123;uid&#125;</code>. To promote an admin, set <code>role</code> to <code>&quot;admin&quot;</code> on that document in Firebase Console → Firestore, and ensure Email/Password auth is enabled in Firebase Console.
              </p>
            </div>
          </form>
        </div>
      ) : route === 'admin' && isAdmin ? (
        /* ADMIN DASHBOARD (/admin) */
        <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 bg-red-50/70 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                  ADMIN AREA
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  All Submitted Files &amp; Data
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Only administrators can query, view, download, and delete records in the <code>uploads</code> collection.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {uploads.length} {uploads.length === 1 ? 'submission' : 'submissions'}
            </div>
          </div>

          {adminError && (
            <div className="m-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200">
              {adminError}
            </div>
          )}

          {adminLoading ? (
            <div className="p-10 text-center text-xs text-slate-500">Loading all submissions...</div>
          ) : uploads.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No files or data have been submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Uploader Email</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Description / Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {uploads.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.uploaderEmail}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatTimestamp(item.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                        {item.description || <span className="text-slate-400 italic">No description</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-2">
                          {item.fileUrl ? (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold hover:bg-indigo-100 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 px-2">Text only</span>
                          )}
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDeleteRecord(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold hover:bg-rose-100 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingId === item.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* REGULAR USER VIEW (and Admin Submission View) — NO upload list or browsing */
        <div className="max-w-xl mx-auto space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Welcome
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 break-all">
                {firebaseUser.email}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Submit files or confidential notes below. Submitted records are sealed immediately and visible exclusively to the administrator.
              </p>
            </div>

            {uploadSuccess && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-start space-x-2.5 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Submission Received</div>
                  <p className="mt-0.5">
                    Your files have been submitted. Only the administrator can view them.
                  </p>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 flex items-start space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Upload File (Optional if submitting text)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    setSelectedFile(e.target.files?.[0] || null);
                    setUploadError('');
                    setUploadSuccess(false);
                  }}
                  className="w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Submitted Text Data
                </label>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setUploadError('');
                    setUploadSuccess(false);
                  }}
                  placeholder="Add description, reference details, or text-only data..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>Uploading to Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center space-x-2 transition disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Submitting...' : 'Submit Securely'}</span>
              </button>
            </form>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Your files have been submitted or will remain private upon submission. Only the administrator can view uploaded data.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
