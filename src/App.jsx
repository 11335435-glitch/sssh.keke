import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BookOpen,
  MessageSquare,
  PlusCircle,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Award,
  GraduationCap,
  Send,
  FolderPlus,
  HeartHandshake,
  Lock,
  Unlock,
  Edit3,
  Trash2,
  Users,
  Filter
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';

// ============================================================================
// 【雲端資料庫設定區】
// 已填入松山高中「課課相傳 (sssh-keke)」專屬 Firebase 雲端資料庫金鑰！
// ============================================================================
const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBEXd-sudvtQ4ofAKktGuqEbGzPwFFf1r0",
  authDomain: "sssh-keke.firebaseapp.com",
  projectId: "sssh-keke",
  storageBucket: "sssh-keke.firebasestorage.app",
  messagingSenderId: "756399231955",
  appId: "1:756399231955:web:b5b5479e4660688926d526"
};

// 管理員後台預設密碼（你可自行修改引號內的密碼）
const ADMIN_PASSCODE = 'sssh2026';

// 自動偵測環境並初始化 Firebase
const hasEnvConfig = typeof __firebase_config !== 'undefined' && __firebase_config;
const hasManualConfig = Boolean(MANUAL_FIREBASE_CONFIG.apiKey && MANUAL_FIREBASE_CONFIG.projectId);
const firebaseConfig = hasEnvConfig
  ? JSON.parse(__firebase_config)
  : hasManualConfig
  ? MANUAL_FIREBASE_CONFIG
  : null;

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'keke-sssh-prod';

// 已清空假課程，預設為空陣列，等待你或同學新增松山高中真實課程
const INITIAL_COURSES = [];

const FILTER_TABS = ['全部課程', '多元選修', '加深加廣', '部定必修', '校訂必修', '高一', '高二', '高三'];

export default function App() {
  // 連線與資料庫狀態
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const isCloudConnected = Boolean(db && user);

  // 介面導航與篩選狀態
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('全部課程');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState('全部老師');

  // 管理員後台狀態
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [adminInputPassword, setAdminInputPassword] = useState('');

  // 彈窗狀態
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null); // 後台編輯課程用

  // Toast 提示訊息
  const [toast, setToast] = useState(null);

  // 表單狀態：新增修課心得（支援在同門課內選擇授課老師）
  const [reviewForm, setReviewForm] = useState({
    courseId: '',
    teacherChoice: '',
    customTeacher: '',
    semester: '114-1',
    grade: '高二',
    author: '',
    comment: ''
  });

  // 表單狀態：新增一門新課程（老師為非必填，支援多位老師用逗號分隔）
  const [courseForm, setCourseForm] = useState({
    name: '',
    teachersText: '',
    category: '多元選修',
    grade: '高二',
    group: '不限班群',
    teachingStyleText: '分組報告, 無筆試',
    description: ''
  });

  // 表單狀態：後台編輯現有課程
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    teachersText: '',
    category: '多元選修',
    grade: '高二',
    group: '不限班群',
    teachingStyleText: '',
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 工具函式：取得課程的老師陣列（相容舊資料格式）
  const getCourseTeachers = (course) => {
    if (Array.isArray(course.teachers) && course.teachers.length > 0) {
      return course.teachers;
    }
    if (course.teacher && course.teacher.trim() && course.teacher !== '依學校選課公告為準') {
      return [course.teacher.trim()];
    }
    return [];
  };

  // 1. 背景自動匿名連線與即時同步課程清單
  useEffect(() => {
    if (!auth || !db) {
      try {
        const savedLocal = localStorage.getItem('keke_sssh_local_courses');
        if (savedLocal) {
          setCourses(JSON.parse(savedLocal));
        } else {
          setCourses(INITIAL_COURSES);
        }
      } catch {
        setCourses(INITIAL_COURSES);
      }
      setIsLoading(false);
      return;
    }

    let unsubscribeCourses = null;

    const initApp = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('背景連線失敗:', err);
        setIsLoading(false);
      }
    };

    initApp();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) return;
      setUser(currentUser);

      const coursesCol = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
      unsubscribeCourses = onSnapshot(
        coursesCol,
        (snapshot) => {
          const loadedCourses = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }));
          loadedCourses.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));
          setCourses(loadedCourses);
          setIsLoading(false);
        },
        (error) => {
          console.error('讀取課程失敗:', error);
          setIsLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCourses) unsubscribeCourses();
    };
  }, []);

  const updateLocalCourses = (updater) => {
    setCourses((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('keke_sssh_local_courses', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedTeacherFilter('全部老師');
  }, [selectedCourseId]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const q = searchQuery.trim().toLowerCase();
      const teachersList = getCourseTeachers(course);
      const matchesSearch =
        !q ||
        course.name.toLowerCase().includes(q) ||
        teachersList.some((t) => t.toLowerCase().includes(q)) ||
        (course.description && course.description.toLowerCase().includes(q));

      const matchesTab =
        activeFilter === '全部課程' ||
        course.category === activeFilter ||
        course.grade === activeFilter;

      return matchesSearch && matchesTab;
    });
  }, [courses, searchQuery, activeFilter]);

  const activeCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  const filteredReviews = useMemo(() => {
    if (!activeCourse) return [];
    const allReviews = activeCourse.reviews || [];
    if (selectedTeacherFilter === '全部老師') return allReviews;
    return allReviews.filter((r) => (r.teacher || '未指定老師') === selectedTeacherFilter);
  }, [activeCourse, selectedTeacherFilter]);

  const openContributeModal = (preselectedCourseId = null) => {
    const targetId = preselectedCourseId || selectedCourseId || (courses[0] ? courses[0].id : '');
    const targetCourse = courses.find((c) => c.id === targetId);
    const teachers = targetCourse ? getCourseTeachers(targetCourse) : [];

    setReviewForm({
      courseId: targetId,
      teacherChoice: teachers.length > 0 ? teachers[0] : '未指定 / 忘記老師',
      customTeacher: '',
      semester: '114-1',
      grade: targetCourse?.grade || '高二',
      author: '',
      comment: ''
    });
    setIsContributeOpen(true);
  };

  const handleReviewCourseChange = (newCourseId) => {
    const targetCourse = courses.find((c) => c.id === newCourseId);
    const teachers = targetCourse ? getCourseTeachers(targetCourse) : [];
    setReviewForm((prev) => ({
      ...prev,
      courseId: newCourseId,
      teacherChoice: teachers.length > 0 ? teachers[0] : '未指定 / 忘記老師',
      customTeacher: ''
    }));
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.courseId || !reviewForm.comment.trim()) {
      showToast('請選擇課程並填寫修課心得內容喔！', 'warning');
      return;
    }

    setIsSubmitting(true);
    const targetCourse = courses.find((c) => c.id === reviewForm.courseId);
    if (!targetCourse) {
      setIsSubmitting(false);
      return;
    }

    let finalTeacher = '未指定老師';
    if (reviewForm.teacherChoice === '__custom__') {
      const raw = reviewForm.customTeacher.trim();
      if (raw) {
        finalTeacher = raw.includes('老師') ? raw : `${raw} 老師`;
      }
    } else if (reviewForm.teacherChoice && reviewForm.teacherChoice !== '未指定 / 忘記老師') {
      finalTeacher = reviewForm.teacherChoice;
    }

    const newReview = {
      id: `r_${Date.now()}`,
      teacher: finalTeacher,
      semester: reviewForm.semester,
      grade: reviewForm.grade,
      author: reviewForm.author.trim() || '熱心松高同學',
      isSeniorBadge: false,
      comment: reviewForm.comment.trim()
    };

    const existingTeachers = getCourseTeachers(targetCourse);
    const updatedTeachers =
      finalTeacher !== '未指定老師' && !existingTeachers.includes(finalTeacher)
        ? [...existingTeachers, finalTeacher]
        : existingTeachers;

    const updatedReviews = [newReview, ...(targetCourse.reviews || [])];

    if (!isCloudConnected) {
      updateLocalCourses((prev) =>
        prev.map((c) =>
          c.id === targetCourse.id
            ? { ...c, teachers: updatedTeachers, reviews: updatedReviews }
            : c
        )
      );
      setIsSubmitting(false);
      setIsContributeOpen(false);
      showToast('感謝分享！你的修課心得已發佈（目前為單機暫存模式）🎉', 'success');
      return;
    }

    try {
      const courseRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', targetCourse.id);
      await updateDoc(courseRef, {
        teachers: updatedTeachers,
        reviews: updatedReviews
      });

      setIsContributeOpen(false);
      showToast('感謝分享！你的修課心得已成功發佈到全校資料庫 🎉', 'success');
    } catch (err) {
      console.error('送出心得失敗:', err);
      showToast('送出時發生一點小問題，請稍後再試！', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.name.trim()) {
      showToast('請填寫課程名稱！', 'warning');
      return;
    }

    setIsSubmitting(true);
    const tagsArray = courseForm.teachingStyleText
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const teachersArray = courseForm.teachersText
      .split(/[,，、/]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.includes('老師') ? t : `${t} 老師`));

    const newCourseData = {
      name: courseForm.name.trim(),
      teachers: teachersArray,
      category: courseForm.category,
      grade: courseForm.grade,
      group: courseForm.group,
      teachingStyle: tagsArray.length > 0 ? tagsArray : ['依課堂公告'],
      description:
        courseForm.description.trim() ||
        '松山高中選修課程，歡迎修過課的學長姐補充上課方式與心得！',
      reviews: []
    };

    if (!isCloudConnected) {
      const localCourse = { id: `c_${Date.now()}`, ...newCourseData };
      updateLocalCourses((prev) => [localCourse, ...prev]);
      setIsSubmitting(false);
      setIsAddCourseOpen(false);
      setSelectedCourseId(localCourse.id);
      setCourseForm({
        name: '',
        teachersText: '',
        category: '多元選修',
        grade: '高二',
        group: '不限班群',
        teachingStyleText: '分組報告, 無筆試',
        description: ''
      });
      showToast(`已建立新課程「${newCourseData.name}」（單機暫存模式）！`, 'success');
      return;
    }

    try {
      const coursesCol = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
      const docRef = await addDoc(coursesCol, newCourseData);
      setIsAddCourseOpen(false);
      setSelectedCourseId(docRef.id);
      setCourseForm({
        name: '',
        teachersText: '',
        category: '多元選修',
        grade: '高二',
        group: '不限班群',
        teachingStyleText: '分組報告, 無筆試',
        description: ''
      });
      showToast(`已為松高資料庫建立新課程「${newCourseData.name}」！`, 'success');
    } catch (err) {
      console.error('新增課程失敗:', err);
      showToast('新增課程失敗，請稍後再試！', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditCourseModal = (course, e) => {
    if (e) e.stopPropagation();
    const teachersList = getCourseTeachers(course);
    setEditForm({
      id: course.id,
      name: course.name,
      teachersText: teachersList.join(', '),
      category: course.category || '多元選修',
      grade: course.grade || '高二',
      group: course.group || '不限班群',
      teachingStyleText: (course.teachingStyle || []).join(', '),
      description: course.description || ''
    });
    setEditingCourse(course);
  };

  const handleSaveCourseEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      showToast('課程名稱不可為空！', 'warning');
      return;
    }

    setIsSubmitting(true);
    const tagsArray = editForm.teachingStyleText
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const teachersArray = editForm.teachersText
      .split(/[,，、/]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.includes('老師') ? t : `${t} 老師`));

    const updatedFields = {
      name: editForm.name.trim(),
      teachers: teachersArray,
      category: editForm.category,
      grade: editForm.grade,
      group: editForm.group,
      teachingStyle: tagsArray.length > 0 ? tagsArray : ['依課堂公告'],
      description: editForm.description.trim()
    };

    if (!isCloudConnected) {
      updateLocalCourses((prev) =>
        prev.map((c) => (c.id === editForm.id ? { ...c, ...updatedFields } : c))
      );
      setIsSubmitting(false);
      setEditingCourse(null);
      showToast('課程資料已更新！', 'success');
      return;
    }

    try {
      const courseRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', editForm.id);
      await updateDoc(courseRef, updatedFields);
      setEditingCourse(null);
      showToast('全校雲端課程資料已更新！', 'success');
    } catch (err) {
      console.error('更新課程失敗:', err);
      showToast('更新失敗，請稍後再試！', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (courseId, courseName, e) => {
    if (e) e.stopPropagation();
    if (!isCloudConnected) {
      updateLocalCourses((prev) => prev.filter((c) => c.id !== courseId));
      if (selectedCourseId === courseId) setSelectedCourseId(null);
      showToast(`已刪除課程「${courseName}」`, 'success');
      return;
    }

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId));
      if (selectedCourseId === courseId) setSelectedCourseId(null);
      showToast(`已從資料庫刪除課程「${courseName}」`, 'success');
    } catch (err) {
      console.error('刪除課程失敗:', err);
      showToast('刪除失敗，請稍後再試！', 'warning');
    }
  };

  const handleDeleteReview = async (courseId, reviewId) => {
    const targetCourse = courses.find((c) => c.id === courseId);
    if (!targetCourse) return;

    const remainingReviews = (targetCourse.reviews || []).filter((r) => r.id !== reviewId);

    if (!isCloudConnected) {
      updateLocalCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, reviews: remainingReviews } : c))
      );
      showToast('已刪除該則心得留言', 'success');
      return;
    }

    try {
      const courseRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId);
      await updateDoc(courseRef, { reviews: remainingReviews });
      showToast('已從雲端資料庫刪除該則心得留言', 'success');
    } catch (err) {
      console.error('刪除心得失敗:', err);
      showToast('刪除失敗，請稍後再試！', 'warning');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminInputPassword === ADMIN_PASSCODE) {
      setIsAdmin(true);
      setIsAdminLoginOpen(false);
      setAdminInputPassword('');
      showToast('已進入管理員編輯模式，可隨時修改或刪除課程與留言！', 'success');
    } else {
      showToast('管理員密碼錯誤，請再試一次！', 'warning');
    }
  };

  const totalReviewsCount = useMemo(
    () => courses.reduce((sum, c) => sum + (c.reviews?.length || 0), 0),
    [courses]
  );

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-slate-800 font-sans selection:bg-[#1b4332] selection:text-white flex flex-col">
      {/* 頂部導航列 */}
      <header className="sticky top-0 z-30 bg-[#1b4332] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => setSelectedCourseId(null)}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center group-hover:bg-white/25 transition">
              <GraduationCap className="w-6 h-6 text-[#b7e4c7]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wide text-white">課課相傳</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#2d6a4f] text-[#d8f3dc] border border-[#52b788]/40">
                  松山高中 SSSH
                </span>
              </div>
              <p className="text-xs text-[#b7e4c7]/90 hidden sm:block">
                免註冊・免登入・松高同學專屬選課心得互助網
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <button
                onClick={() => {
                  setIsAdmin(false);
                  showToast('已退出管理員模式', 'success');
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-900 hover:bg-amber-400 transition shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">管理員模式中 (點此登出)</span>
                <span className="sm:hidden">管理中</span>
              </button>
            )}

            <button
              onClick={() => setIsAddCourseOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
            >
              <FolderPlus className="w-4 h-4 text-[#b7e4c7]" />
              <span>新增課程</span>
            </button>

            <button
              onClick={() => openContributeModal()}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#d8f3dc] text-[#1b4332] hover:bg-white shadow-sm transition transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>分享心得</span>
            </button>
          </div>
        </div>
      </header>

      {!isLoading && !isCloudConnected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-800 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            目前為<strong>本機展示模式</strong>（資料暫存於此瀏覽器）；完成 Firebase 設定後即可全校同步共享！
          </span>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-bounce">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium ${
              toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-[#1b4332] border-[#2d6a4f] text-white'
            }`}
          >
            {toast.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#95d5b2] shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {selectedCourseId && activeCourse ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedCourseId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b4332] hover:text-[#2d6a4f] bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                返回所有松高課程列表
              </button>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => openEditCourseModal(activeCourse, e)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 px-3 py-2 rounded-xl border border-amber-300 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    編輯課程資訊
                  </button>
                  <button
                    onClick={(e) => handleDeleteCourse(activeCourse.id, activeCourse.name, e)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-rose-100 text-rose-800 hover:bg-rose-200 px-3 py-2 rounded-xl border border-rose-300 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    刪除整門課
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#d8f3dc]/40 rounded-bl-full -z-0 pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1b4332] text-white">
                      {activeCourse.category}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#e9f5ee] text-[#1b4332]">
                      {activeCourse.grade}・{activeCourse.group}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {activeCourse.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 font-medium">
                    <Users className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                    <span>授課老師：</span>
                    {getCourseTeachers(activeCourse).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {getCourseTeachers(activeCourse).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-0.5 rounded-lg bg-[#e9f5ee] text-[#1b4332] font-semibold text-xs border border-[#b7e4c7]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">尚未指定（依學校選課公告為準）</span>
                    )}
                  </div>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed pt-1">
                    {activeCourse.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {(activeCourse.teachingStyle || []).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#f4f9f6] border border-[#b7e4c7] rounded-2xl p-5 flex flex-col items-center justify-center text-center min-w-[210px] shrink-0">
                  <span className="text-xs font-semibold text-[#2d6a4f] uppercase tracking-wider">
                    學長姐真實回饋
                  </span>
                  <div className="text-4xl font-black text-[#1b4332] my-1">
                    {(activeCourse.reviews || []).length}
                    <span className="text-base font-bold text-slate-500 ml-1">則心得</span>
                  </div>
                  <button
                    onClick={() => openContributeModal(activeCourse.id)}
                    className="mt-3 w-full py-2.5 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    我也修過這門課
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#1b4332]" />
                  修課心得與選課建議 ({filteredReviews.length})
                </h2>

                {(activeCourse.reviews || []).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      依老師篩選：
                    </span>
                    <button
                      onClick={() => setSelectedTeacherFilter('全部老師')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                        selectedTeacherFilter === '全部老師'
                          ? 'bg-[#1b4332] text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      全部老師
                    </button>
                    {Array.from(
                      new Set(
                        (activeCourse.reviews || []).map((r) => r.teacher || '未指定老師')
                      )
                    ).map((teacherName) => (
                      <button
                        key={teacherName}
                        onClick={() => setSelectedTeacherFilter(teacherName)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          selectedTeacherFilter === teacherName
                            ? 'bg-[#1b4332] text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {teacherName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredReviews.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300 space-y-3">
                  <p className="text-slate-500 text-sm">
                    {selectedTeacherFilter === '全部老師'
                      ? '這門課目前還沒有人留下心得，快來當第一位造福學弟妹的松高人吧！'
                      : `目前還沒有「${selectedTeacherFilter}」的修課心得喔！`}
                  </p>
                  <button
                    onClick={() => openContributeModal(activeCourse.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1b4332] text-white text-xs font-bold hover:bg-[#2d6a4f] transition"
                  >
                    <PlusCircle className="w-4 h-4" />
                    立刻寫下第一則心得
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4 hover:border-[#52b788] transition relative"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#e9f5ee] text-[#1b4332]">
                              {review.semester} 學期
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {review.grade}修課
                            </span>
                            {review.teacher && review.teacher !== '未指定老師' && (
                              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                授課：{review.teacher}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {review.isSeniorBadge && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <Award className="w-3 h-3 text-amber-500" />
                                學長姐經驗傳承
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteReview(activeCourse.id, review.id)}
                                title="管理員刪除這則留言"
                                className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                          「{review.comment}」
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">— {review.author}</span>
                        <span>真實修課回饋</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            <div className="bg-gradient-to-br from-[#1b4332] via-[#23533e] to-[#2d6a4f] rounded-3xl p-6 sm:p-10 text-white shadow-lg relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
              <div className="absolute right-20 -top-12 w-40 h-40 bg-[#95d5b2]/10 rounded-full pointer-events-none" />

              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[#d8f3dc] text-xs font-semibold backdrop-blur-sm">
                  <HeartHandshake className="w-4 h-4 text-[#95d5b2]" />
                  免註冊帳號・直接瀏覽與分享・專屬於松高人的選課指南
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-snug">
                  選課前先來「課課相傳」看看，
                  <br className="hidden sm:block" />
                  找到最適合你的松高好課！
                </h1>

                <p className="text-sm sm:text-base text-[#d8f3dc]/90 leading-relaxed max-w-2xl">
                  彙整松山高中多元選修、加深加廣與必修課程的真實上課方式、評量比例與學長姐建議。不打分數、不貼標籤，用最溫暖真實的經驗傳承幫助彼此。
                </p>

                <div className="pt-2">
                  <div className="relative max-w-2xl">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜尋課程名稱、授課老師或關鍵字（例如：程式、心理、無筆試...）"
                      className="w-full pl-12 pr-10 py-3.5 sm:py-4 rounded-2xl bg-white text-slate-800 placeholder-slate-400 text-sm sm:text-base shadow-md focus:outline-none focus:ring-4 focus:ring-[#95d5b2]/40"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#b7e4c7]">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    已收錄 <strong>{courses.length}</strong> 門松高課程
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    累積 <strong>{totalReviewsCount}</strong> 則學長姐真實心得
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTER_TABS.map((tab) => {
                  const isActive = activeFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
                        isActive
                          ? 'bg-[#1b4332] text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-[#e9f5ee] hover:text-[#1b4332] border border-slate-200/80'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-medium text-slate-500">
                顯示 {filteredCourses.length} 門課程
              </span>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="bg-white rounded-2xl p-6 border border-slate-200/70 animate-pulse space-y-4 h-60"
                  >
                    <div className="h-5 bg-slate-200 rounded w-1/3" />
                    <div className="h-7 bg-slate-200 rounded w-3/4" />
                    <div className="h-16 bg-slate-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#e9f5ee] text-[#1b4332] flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-800">
                    {courses.length === 0 ? '目前資料庫還是全新的起步狀態！' : '找不到符合條件的課程'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {courses.length === 0
                      ? '點擊下方按鈕新增第一門松山高中課程（授課老師可先留白沒關係喔！）。'
                      : '試試看切換其他分類，或者直接幫松高資料庫新增這門課！'}
                  </p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  {searchQuery || activeFilter !== '全部課程' ? (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('全部課程');
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                    >
                      清除篩選條件
                    </button>
                  ) : null}
                  <button
                    onClick={() => setIsAddCourseOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#1b4332] text-white text-xs font-bold hover:bg-[#2d6a4f] inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <FolderPlus className="w-4 h-4" />
                    新增第一門松高課程
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCourses.map((course) => {
                  const reviewCount = (course.reviews || []).length;
                  const latestReview = course.reviews && course.reviews[0];
                  const teachersList = getCourseTeachers(course);

                  return (
                    <div
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className="group bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-[#40916c] transition-all cursor-pointer flex flex-col justify-between gap-4 relative"
                    >
                      {isAdmin && (
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-xl border border-slate-200 shadow-sm">
                          <button
                            onClick={(e) => openEditCourseModal(course, e)}
                            title="編輯課程"
                            className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteCourse(course.id, course.name, e)}
                            title="刪除課程"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#e9f5ee] text-[#1b4332]">
                            {course.category}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {course.grade}・{course.group}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-[#1b4332] transition line-clamp-1">
                            {course.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                            授課老師：
                            {teachersList.length > 0
                              ? teachersList.join('、')
                              : '尚未指定（依選課公告）'}
                          </p>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(course.teachingStyle || []).slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        {latestReview ? (
                          <div className="bg-[#f8faf9] rounded-xl p-2.5 text-xs text-slate-600 line-clamp-2 italic">
                            「{latestReview.comment}」
                          </div>
                        ) : (
                          <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-400 text-center">
                            尚無心得，點此搶先分享！
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-[#2d6a4f] flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {reviewCount} 則修課心得
                          </span>
                          <span className="text-[#1b4332] group-hover:translate-x-1 transition-transform">
                            查看詳情 →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1b4332]">課課相傳</span>
            <span>｜臺北市立松山高級中學 學生自主選課互助平台</span>
          </div>
          <div className="flex items-center gap-4">
            <span>免註冊・免登入・友善交流</span>
            <button
              onClick={() => {
                if (isAdmin) {
                  setIsAdmin(false);
                  showToast('已登出管理員後台', 'success');
                } else {
                  setIsAdminLoginOpen(true);
                }
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-[#1b4332] transition"
            >
              {isAdmin ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isAdmin ? '登出管理員' : '管理員後台'}</span>
            </button>
          </div>
        </div>
      </footer>

      {isContributeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">分享你的修課心得</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  免登入帳號，直接選擇課程與授課老師就能造福學弟妹！
                </p>
              </div>
              <button
                onClick={() => setIsContributeOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {courses.length === 0 ? (
              <div className="py-8 text-center space-y-4">
                <p className="text-sm text-slate-600">
                  目前還沒有任何課程喔！請先建立一門課程後再分享心得。
                </p>
                <button
                  onClick={() => {
                    setIsContributeOpen(false);
                    setIsAddCourseOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#1b4332] text-white text-xs font-bold"
                >
                  前往新增課程
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddReview} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1. 選擇你修過的課程 *
                  </label>
                  <select
                    value={reviewForm.courseId}
                    onChange={(e) => handleReviewCourseChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1b4332]"
                    required
                  >
                    <option value="" disabled>
                      -- 請選擇松山高中課程 --
                    </option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c.category}）
                      </option>
                    ))}
                  </select>
                </div>

                {reviewForm.courseId && (
                  <div className="bg-[#f4f9f6] p-3.5 rounded-2xl border border-[#b7e4c7]/70 space-y-2.5">
                    <label className="block text-xs font-bold text-[#1b4332]">
                      2. 當時的授課老師是哪一位？（選填）
                    </label>
                    <select
                      value={reviewForm.teacherChoice}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, teacherChoice: e.target.value })
                      }
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1b4332]"
                    >
                      {(() => {
                        const selectedCourseObj = courses.find(
                          (c) => c.id === reviewForm.courseId
                        );
                        const teachers = selectedCourseObj
                          ? getCourseTeachers(selectedCourseObj)
                          : [];
                        return (
                          <>
                            {teachers.map((t, idx) => (
                              <option key={idx} value={t}>
                                {t}
                              </option>
                            ))}
                            <option value="未指定 / 忘記老師">未指定 / 忘記老師</option>
                            <option value="__custom__">+ 自行輸入其他授課老師姓名</option>
                          </>
                        );
                      })()}
                    </select>

                    {reviewForm.teacherChoice === '__custom__' && (
                      <input
                        type="text"
                        value={reviewForm.customTeacher}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, customTeacher: e.target.value })
                        }
                        placeholder="請輸入老師姓氏或全名（例如：王大明）"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1b4332]"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      修課學期
                    </label>
                    <select
                      value={reviewForm.semester}
                      onChange={(e) => setReviewForm({ ...reviewForm, semester: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1b4332]"
                    >
                      <option value="114-1">114-1 學期</option>
                      <option value="113-2">113-2 學期</option>
                      <option value="113-1">113-1 學期</option>
                      <option value="112-2">112-2 學期</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      當時年級
                    </label>
                    <select
                      value={reviewForm.grade}
                      onChange={(e) => setReviewForm({ ...reviewForm, grade: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-[#1b4332]"
                    >
                      <option value="高一">高一</option>
                      <option value="高二">高二</option>
                      <option value="高三">高三</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    你的署名 / 暱稱（選填，留白將顯示為「熱心松高同學」）
                  </label>
                  <input
                    type="text"
                    value={reviewForm.author}
                    onChange={(e) => setReviewForm({ ...reviewForm, author: e.target.value })}
                    placeholder="例如：308 學長、熱愛程式的高二生"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    修課心得與選課建議 *
                  </label>
                  <textarea
                    rows={4}
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="可以分享：上課都在做什麼？老師的教學風格？有沒有分組報告或期末考？推薦給什麼樣的同學選修？"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                    required
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsContributeOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1b4332] hover:bg-[#2d6a4f] text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isSubmitting ? '發佈中...' : '送出心得'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isAddCourseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">新增松山高中課程</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  找不到你想分享的課嗎？直接建檔讓全校同學都能看到！
                </p>
              </div>
              <button
                onClick={() => setIsAddCourseOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">課程名稱 *</label>
                <input
                  type="text"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  placeholder="例如：人工智慧導論、日常心理學"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  授課老師（選填，若有多位老師請用逗號分隔）
                </label>
                <input
                  type="text"
                  value={courseForm.teachersText}
                  onChange={(e) => setCourseForm({ ...courseForm, teachersText: e.target.value })}
                  placeholder="例如：林雅婷, 陳建宏（若尚未公布可先留白）"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">課程類別</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1b4332]"
                  >
                    <option value="多元選修">多元選修</option>
                    <option value="加深加廣">加深加廣</option>
                    <option value="校訂必修">校訂必修</option>
                    <option value="部定必修">部定必修</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">開課年級</label>
                  <select
                    value={courseForm.grade}
                    onChange={(e) => setCourseForm({ ...courseForm, grade: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1b4332]"
                  >
                    <option value="高一">高一</option>
                    <option value="高二">高二</option>
                    <option value="高三">高三</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">適用班群</label>
                  <input
                    type="text"
                    value={courseForm.group}
                    onChange={(e) => setCourseForm({ ...courseForm, group: e.target.value })}
                    placeholder="不限班群"
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#1b4332]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  課程特色標籤（用逗號分隔）
                </label>
                <input
                  type="text"
                  value={courseForm.teachingStyleText}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, teachingStyleText: e.target.value })
                  }
                  placeholder="例如：分組報告, 實作體驗, 無筆試"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  課程簡介（選填）
                </label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="簡單介紹這門課的大綱或上課內容..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddCourseOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1b4332] hover:bg-[#2d6a4f] text-white flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  {isSubmitting ? '建立中...' : '確認新增課程'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdminLoginOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#1b4332]" />
                管理員後台登入
              </h3>
              <button
                onClick={() => setIsAdminLoginOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              登入後可隨時編輯課程名稱、補填授課老師名單，或刪除不適當的留言。
            </p>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="password"
                value={adminInputPassword}
                onChange={(e) => setAdminInputPassword(e.target.value)}
                placeholder="請輸入管理員密碼"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold transition"
              >
                進入管理模式
              </button>
            </form>
          </div>
        </div>
      )}

      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">管理員：編輯課程資訊</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  可直接修正課名，或用逗號一次補齊多位授課老師
                </p>
              </div>
              <button
                onClick={() => setEditingCourse(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourseEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">課程名稱 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  授課老師清單（多位老師請用逗號分隔）
                </label>
                <input
                  type="text"
                  value={editForm.teachersText}
                  onChange={(e) => setEditForm({ ...editForm, teachersText: e.target.value })}
                  placeholder="例如：林雅婷 老師, 陳建宏 老師"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">課程類別</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1b4332]"
                  >
                    <option value="多元選修">多元選修</option>
                    <option value="加深加廣">加深加廣</option>
                    <option value="校訂必修">校訂必修</option>
                    <option value="部定必修">部定必修</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">開課年級</label>
                  <select
                    value={editForm.grade}
                    onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#1b4332]"
                  >
                    <option value="高一">高一</option>
                    <option value="高二">高二</option>
                    <option value="高三">高三</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">適用班群</label>
                  <input
                    type="text"
                    value={editForm.group}
                    onChange={(e) => setEditForm({ ...editForm, group: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-[#1b4332]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  課程特色標籤（用逗號分隔）
                </label>
                <input
                  type="text"
                  value={editForm.teachingStyleText}
                  onChange={(e) =>
                    setEditForm({ ...editForm, teachingStyleText: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">課程簡介</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1b4332] hover:bg-[#2d6a4f] text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? '儲存中...' : '儲存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
