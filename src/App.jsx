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
  HeartHandshake
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';

// 初始化雲端服務（支援環境變數與獨立網址部署雙模式，同學免註冊即可使用）
const hasFirebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config;
const firebaseConfig = hasFirebaseConfig ? JSON.parse(__firebase_config) : null;
const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'keke-sssh-prod';

// 初始種子課程資料（純修課心得版，無打分與考古題）
const INITIAL_COURSES = [
  {
    id: 'course-1',
    name: '專題寫作與表達',
    teacher: '林雅婷 老師',
    category: '多元選修',
    grade: '高二',
    group: '不限班群',
    teachingStyle: ['分組報告', '課堂討論', '無筆試'],
    description: '訓練從生活觀察發想研究題目，練習文獻整理、簡報製作與上台口頭發表，非常適合用來累積學習歷程檔案！',
    reviews: [
      {
        id: 'r101',
        semester: '114-1',
        grade: '高二',
        author: '214班 學姐',
        isSeniorBadge: true,
        comment: '老師人超級親切！每次小組討論都會一組一組過來給建議，不會讓人覺得沒方向。期末只要把小論文架構跟簡報做好就可以，學習歷程直接多一份超有質感的檔案！'
      },
      {
        id: 'r102',
        semester: '113-2',
        grade: '高二',
        author: '205班 同學',
        isSeniorBadge: false,
        comment: '建議找認識或做事負責任的同學一組會很開心，上課氣氛很輕鬆，沒有考試壓力。'
      }
    ]
  },
  {
    id: 'course-2',
    name: '微積分（加深加廣）',
    teacher: '陳建宏 老師',
    category: '加深加廣',
    grade: '高三',
    group: '自然組',
    teachingStyle: ['板書講解', '隨堂小考', '期末筆試'],
    description: '銜接大學理工與商管學院的基礎微積分課程，涵蓋極限、微分技巧與積分應用，建立紮實的數學推導能力。',
    reviews: [
      {
        id: 'r201',
        semester: '114-1',
        grade: '高三',
        author: '318班 學長',
        isSeniorBadge: true,
        comment: '建宏老師講解觀念非常清楚，會把微積分的幾何意義畫出來，不會叫你死背公式。高三下學好這門課，大一微積分真的輕鬆很多！'
      }
    ]
  },
  {
    id: 'course-3',
    name: '自然科學探究與實作',
    teacher: '張哲維 老師',
    category: '部定必修',
    grade: '高二',
    group: '不限班群',
    teachingStyle: ['實驗操作', '小組合作', '實作海報'],
    description: '透過動手設計物理與生活科學實驗，學習變因控制、數據分析與科學海報發表。',
    reviews: [
      {
        id: 'r301',
        semester: '113-2',
        grade: '高二',
        author: '211班 學姐',
        isSeniorBadge: true,
        comment: '很多時間都在實驗室做實驗跟測數據，比單純聽講有趣很多！記得實驗數據要好好記錄，期末做海報報告時會用到。'
      }
    ]
  },
  {
    id: 'course-4',
    name: '英文閱讀與寫作',
    teacher: 'Sarah Wu 老師',
    category: '加深加廣',
    grade: '高三',
    group: '社會組',
    teachingStyle: ['外媒選讀', '短文寫作', '全英互動'],
    description: '精選國際時事與文化專題文章，訓練英文長文閱讀速度、段落架構分析與學測英文作文技巧。',
    reviews: [
      {
        id: 'r401',
        semester: '114-1',
        grade: '高三',
        author: '302班 學姐',
        isSeniorBadge: true,
        comment: '老師改作文超用心，每篇都會寫滿滿的回饋跟更道地的替換句型！想衝高學測英文作文的同學強烈建議選這堂。'
      }
    ]
  },
  {
    id: 'course-5',
    name: '創意程式設計與互動媒體',
    teacher: '王俊傑 老師',
    category: '多元選修',
    grade: '高一',
    group: '不限班群',
    teachingStyle: ['電腦實作', '個人作品', '無紙本作業'],
    description: '零基礎也能上手的程式設計課！使用視覺化程式與網頁互動工具，做出屬於自己的小遊戲或動畫作品。',
    reviews: [
      {
        id: 'r501',
        semester: '114-1',
        grade: '高一',
        author: '116班 學長',
        isSeniorBadge: false,
        comment: '在電腦教室上課超讚！完全沒寫過程式也不用怕，老師步調很穩，遇到 Bug 舉手老師都會很有耐心地幫忙看。'
      }
    ]
  },
  {
    id: 'course-6',
    name: '現代公民與社會議題思辨',
    teacher: '李佩珊 老師',
    category: '多元選修',
    grade: '高二',
    group: '社會組',
    teachingStyle: ['議題辯論', '電影賞析', '心得反思'],
    description: '從轉型正義、媒體識讀到環境永續，透過分組模擬辯論與紀錄片賞析，培養獨立思考與多元觀點表達。',
    reviews: [
      {
        id: 'r601',
        semester: '113-1',
        grade: '高二',
        author: '203班 學姐',
        isSeniorBadge: true,
        comment: '非常推薦對法政、社會學群有興趣的同學！課堂上的辯論活動不會太嚴肅，大家可以很自在地交換想法，老師也會補充很多延伸資料。'
      }
    ]
  }
];

const FILTER_TABS = ['全部課程', '多元選修', '加深加廣', '部定必修', '高一', '高二', '高三'];

export default function App() {
  // 使用者背景匿名連線狀態（免註冊即用）
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 介面導航與篩選狀態
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('全部課程');

  // 彈窗狀態
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);

  // Toast 提示訊息
  const [toast, setToast] = useState(null);

  // 表單狀態：新增修課心得
  const [reviewForm, setReviewForm] = useState({
    courseId: '',
    semester: '114-1',
    grade: '高二',
    author: '',
    comment: ''
  });

  // 表單狀態：新增一門新課程
  const [courseForm, setCourseForm] = useState({
    name: '',
    teacher: '',
    category: '多元選修',
    grade: '高二',
    group: '不限班群',
    teachingStyleText: '分組報告, 無筆試',
    description: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  // 1. 背景自動匿名連線與即時同步課程清單（免註冊即用）
  useEffect(() => {
    // 若部署於獨立外部網址且尚未填入 Firebase 金鑰，自動載入內建課程資料並正常運作
    if (!auth || !db) {
      setCourses(INITIAL_COURSES);
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
        console.error('背景連線失敗，切換為本機展示模式:', err);
        setCourses(INITIAL_COURSES);
        setIsLoading(false);
      }
    };

    initApp();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) return;
      setUser(currentUser);

      // 監聽全校公開課程資料庫
      const coursesCol = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
      unsubscribeCourses = onSnapshot(
        coursesCol,
        async (snapshot) => {
          if (snapshot.empty) {
            // 首次啟用時自動寫入松山高中示範課程
            for (const item of INITIAL_COURSES) {
              const { id, ...data } = item;
              await setDoc(doc(coursesCol, id), data);
            }
          } else {
            const loadedCourses = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data()
            }));
            // 依照心得數量多寡排序，讓熱門課程優先顯示
            loadedCourses.sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));
            setCourses(loadedCourses);
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('讀取課程失敗:', error);
          setCourses(INITIAL_COURSES);
          setIsLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCourses) unsubscribeCourses();
    };
  }, []);

  // 當課程清單載入後，預設心得表單的第一個選項
  useEffect(() => {
    if (courses.length > 0 && !reviewForm.courseId) {
      setReviewForm((prev) => ({
        ...prev,
        courseId: selectedCourseId || courses[0].id
      }));
    }
  }, [courses, selectedCourseId, reviewForm.courseId]);

  // 篩選後的課程列表
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        course.name.toLowerCase().includes(q) ||
        course.teacher.toLowerCase().includes(q) ||
        (course.description && course.description.toLowerCase().includes(q));

      const matchesTab =
        activeFilter === '全部課程' ||
        course.category === activeFilter ||
        course.grade === activeFilter;

      return matchesSearch && matchesTab;
    });
  }, [courses, searchQuery, activeFilter]);

  // 當前選中的課程詳情
  const activeCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  // 開啟「分享心得」彈窗
  const openContributeModal = (preselectedCourseId = null) => {
    const targetId = preselectedCourseId || selectedCourseId || (courses[0] ? courses[0].id : '');
    setReviewForm((prev) => ({ ...prev, courseId: targetId }));
    setIsContributeOpen(true);
  };

  // 2. 新增課程評價（純文字心得，無打分）
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

    const newReview = {
      id: `r_${Date.now()}`,
      semester: reviewForm.semester,
      grade: reviewForm.grade,
      author: reviewForm.author.trim() || '熱心松高同學',
      isSeniorBadge: false,
      comment: reviewForm.comment.trim()
    };

    // 若尚未綁定外部資料庫金鑰，直接即時更新前端畫面讓試用者體驗
    if (!db || !user) {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === targetCourse.id
            ? { ...c, reviews: [newReview, ...c.reviews] }
            : c
        )
      );
      setIsSubmitting(false);
      setIsContributeOpen(false);
      setReviewForm({
        courseId: targetCourse.id,
        semester: '114-1',
        grade: '高二',
        author: '',
        comment: ''
      });
      showToast('感謝分享！你的修課心得已成功發佈囉 🎉', 'success');
      return;
    }

    try {
      const courseRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', targetCourse.id);
      const updatedReviews = [newReview, ...targetCourse.reviews];

      await updateDoc(courseRef, { reviews: updatedReviews });

      setIsContributeOpen(false);
      setReviewForm({
        courseId: targetCourse.id,
        semester: '114-1',
        grade: '高二',
        author: '',
        comment: ''
      });
      showToast('感謝分享！你的修課心得已成功發佈囉 🎉', 'success');
    } catch (err) {
      console.error('送出心得失敗:', err);
      showToast('送出時發生一點小問題，請稍後再試！', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. 新增一門全新課程
  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.name.trim() || !courseForm.teacher.trim()) {
      showToast('請完整填寫課程名稱與授課老師姓名！', 'warning');
      return;
    }

    setIsSubmitting(true);
    const tagsArray = courseForm.teachingStyleText
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const newCourseData = {
      name: courseForm.name.trim(),
      teacher: courseForm.teacher.trim().includes('老師')
        ? courseForm.teacher.trim()
        : `${courseForm.teacher.trim()} 老師`,
      category: courseForm.category,
      grade: courseForm.grade,
      group: courseForm.group,
      teachingStyle: tagsArray.length > 0 ? tagsArray : ['課堂講解'],
      description: courseForm.description.trim() || '同學新增的松山高中課程，歡迎修過課的學長姐補充心得！',
      reviews: []
    };

    // 若尚未綁定外部資料庫金鑰，直接即時更新前端畫面
    if (!db || !user) {
      const localCourse = { id: `c_${Date.now()}`, ...newCourseData };
      setCourses((prev) => [localCourse, ...prev]);
      setIsSubmitting(false);
      setIsAddCourseOpen(false);
      setCourseForm({
        name: '',
        teacher: '',
        category: '多元選修',
        grade: '高二',
        group: '不限班群',
        teachingStyleText: '分組報告, 無筆試',
        description: ''
      });
      setSelectedCourseId(localCourse.id);
      showToast(`已成功建立「${newCourseData.name}」，快來搶頭香留心得吧！`, 'success');
      return;
    }

    try {
      const coursesCol = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
      const docRef = await addDoc(coursesCol, newCourseData);

      setIsAddCourseOpen(false);
      setCourseForm({
        name: '',
        teacher: '',
        category: '多元選修',
        grade: '高二',
        group: '不限班群',
        teachingStyleText: '分組報告, 無筆試',
        description: ''
      });
      setSelectedCourseId(docRef.id);
      showToast(`已成功建立「${newCourseData.name}」，快來搶頭香留心得吧！`, 'success');
    } catch (err) {
      console.error('新增課程失敗:', err);
      showToast('新增課程失敗，請稍後再試！', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1F2937] font-sans selection:bg-[#A3E4D7] selection:text-[#1F2937] flex flex-col">
      {/* Toast 懸浮通知 */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-bounce">
          <div
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-lg border ${
              toast.type === 'warning'
                ? 'bg-[#FDE68A] border-amber-300 text-[#1F2937]'
                : 'bg-[#14969C] border-[#117e83] text-white'
            }`}
          >
            {toast.type === 'warning' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-800" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-[#A3E4D7]" />
            )}
            <p className="text-sm font-medium leading-snug">{toast.message}</p>
          </div>
        </div>
      )}

      {/* 頂部導覽列（免註冊極簡版） */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <button
            onClick={() => setSelectedCourseId(null)}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#14969C] flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#14969C]">
                  課課相傳
                </span>
                <span className="hidden md:inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#A3E4D7]/50 text-[#0f6d72]">
                  松山高中 SSSH
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 hidden sm:block">
                松山高中課程資訊與學長姐心得共享庫
              </p>
            </div>
          </button>

          {/* 右側動作按鈕：免註冊直接分享 */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 bg-stone-100 px-3 py-1.5 rounded-full">
              <HeartHandshake className="w-3.5 h-3.5 text-[#14969C]" />
              免註冊・自由瀏覽與分享
            </span>

            <button
              onClick={() => openContributeModal()}
              className="flex items-center gap-1.5 bg-[#FDE68A] hover:bg-amber-300 active:scale-95 text-[#1F2937] font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2.5 rounded-2xl shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#14969C]" />
              <span>分享修課心得</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主要內容區 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#A3E4D7]/50 flex items-center justify-center animate-pulse mb-4">
              <BookOpen className="w-6 h-6 text-[#14969C]" />
            </div>
            <p className="text-stone-600 font-semibold">正在載入松山高中課程資訊...</p>
          </div>
        ) : !activeCourse ? (
          /* ================= 首頁：探索課程 ================= */
          <div className="space-y-6 sm:space-y-8">
            {/* Hero 親切歡迎橫幅 */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#14969C] via-[#178a90] to-[#0f7277] text-white p-6 sm:p-9 shadow-sm">
              <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-[#FDE68A]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>專屬於松高人的選課互助小站</span>
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-snug">
                  選課不踩雷，方向更明確！
                  <br className="hidden sm:inline" />
                  看看松高學長姐怎麼說
                </h1>
                <p className="text-sm sm:text-base text-teal-50/90 leading-relaxed">
                  不用註冊帳號、沒有複雜規則。點開課程就能了解上課方式與真實修課體驗，也歡迎留下你的心得幫助學弟妹！
                </p>
              </div>

              {/* 裝飾用柔和水波圓形 */}
              <div className="hidden sm:block absolute -right-12 -bottom-16 w-64 h-64 rounded-full bg-[#A3E4D7]/20 pointer-events-none" />
              <div className="hidden sm:block absolute right-24 -top-12 w-36 h-36 rounded-full bg-[#FDE68A]/15 pointer-events-none" />
            </section>

            {/* 搜尋與快捷篩選區 */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋課程名稱（如：微積分、探究）、授課老師或關鍵字..."
                    className="w-full pl-11 pr-10 py-3.5 bg-white border border-stone-200 rounded-2xl text-sm sm:text-base shadow-2xs focus:outline-none focus:border-[#14969C] focus:ring-2 focus:ring-[#A3E4D7]/60 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsAddCourseOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-white hover:bg-[#A3E4D7]/25 text-[#14969C] font-bold text-sm border border-[#14969C]/30 shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>找不到課程？新增課程</span>
                </button>
              </div>

              {/* 快捷分類標籤列 */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTER_TABS.map((tab) => {
                  const isActive = activeFilter === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#14969C] text-white shadow-xs'
                          : 'bg-white text-stone-600 hover:bg-[#A3E4D7]/40 hover:text-[#1F2937] border border-stone-200/80'
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 課程卡片列表 */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-bold text-[#1F2937] flex items-center gap-2">
                  <span>探索課程清單</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#A3E4D7]/60 text-[#0e666b]">
                    共 {filteredCourses.length} 門課
                  </span>
                </h2>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-200/80 p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#A3E4D7]/40 text-[#14969C] flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-stone-800">找不到符合條件的課程耶</h3>
                  <p className="text-sm text-stone-500">
                    試試看其他關鍵字，或是直接幫大家新增這門課程！
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFilter('全部課程');
                      }}
                      className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                    >
                      清除篩選
                    </button>
                    <button
                      onClick={() => setIsAddCourseOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#14969C] text-white text-sm font-semibold hover:bg-[#117e83] transition-colors cursor-pointer"
                    >
                      ＋ 新增這門課程
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCourses.map((course) => {
                    const latestReview = course.reviews?.[0];
                    return (
                      <article
                        key={course.id}
                        onClick={() => setSelectedCourseId(course.id)}
                        className="group bg-white rounded-2xl border border-stone-200/90 hover:border-[#14969C]/60 p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          {/* 頂部類別與年級標籤 */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#A3E4D7]/60 text-[#0d6266]">
                                {course.category}
                              </span>
                              <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-stone-100 text-stone-600">
                                {course.grade}
                              </span>
                              {course.group && course.group !== '不限班群' && (
                                <span className="px-2 py-1 rounded-xl text-xs font-medium bg-[#FDE68A]/50 text-amber-900">
                                  {course.group}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 課名與授課老師 */}
                          <h3 className="text-lg font-extrabold text-[#1F2937] group-hover:text-[#14969C] transition-colors line-clamp-1">
                            {course.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1 flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-[#14969C]" />
                            <span>{course.teacher}</span>
                          </p>

                          {/* 課程簡介 */}
                          <p className="text-xs sm:text-sm text-stone-600 mt-3 line-clamp-2 leading-relaxed">
                            {course.description}
                          </p>

                          {/* 上課方式標籤 */}
                          {course.teachingStyle && course.teachingStyle.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {course.teachingStyle.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-[#FAFAF9] border border-stone-200 text-stone-600"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 精選一則最新心得預覽 */}
                          {latestReview ? (
                            <div className="mt-4 p-3 rounded-xl bg-[#FAFAF9] border border-stone-100">
                              <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                                「{latestReview.comment}」
                              </p>
                              <p className="text-[11px] text-stone-400 font-medium mt-1 text-right">
                                — {latestReview.author}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-4 p-3 rounded-xl bg-[#FDE68A]/25 border border-[#FDE68A]/60 text-center">
                              <p className="text-xs text-amber-900 font-medium">
                                還沒有修課心得，歡迎搶頭香分享！
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 底部統計 */}
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-stone-600">
                          <span className="flex items-center gap-1.5 text-[#14969C]">
                            <MessageSquare className="w-4 h-4" />
                            <span>{course.reviews?.length || 0} 則修課心得</span>
                          </span>
                          <span className="text-[#14969C] group-hover:translate-x-0.5 transition-transform">
                            查看全部 →
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ================= 課程詳情檢視（純課程資訊與修課心得） ================= */
          <div className="space-y-6">
            {/* 返回首頁按鈕 */}
            <button
              onClick={() => setSelectedCourseId(null)}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#14969C] hover:text-[#0f7277] bg-white px-4 py-2 rounded-2xl border border-stone-200/80 shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回所有課程</span>
            </button>

            {/* 課程完整資訊卡片 */}
            <section className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-8 shadow-2xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-bold bg-[#A3E4D7]/70 text-[#0c5c60]">
                    {activeCourse.category}
                  </span>
                  <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold bg-stone-100 text-stone-700">
                    {activeCourse.grade}
                  </span>
                  <span className="px-3 py-1 rounded-xl text-xs sm:text-sm font-semibold bg-[#FDE68A]/60 text-amber-900">
                    {activeCourse.group || '不限班群'}
                  </span>
                </div>

                <button
                  onClick={() => openContributeModal(activeCourse.id)}
                  className="inline-flex items-center gap-1.5 bg-[#FDE68A] hover:bg-amber-300 text-[#1F2937] font-bold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-2xs transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-[#14969C]" />
                  <span>寫這門課的心得</span>
                </button>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2937]">
                  {activeCourse.name}
                </h1>
                <p className="text-sm sm:text-base text-stone-600 font-semibold mt-1.5 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#14969C]" />
                  <span>授課老師：{activeCourse.teacher}</span>
                </p>
              </div>

              <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                {activeCourse.description}
              </p>

              {/* 上課方式標籤 */}
              <div className="pt-2">
                <span className="text-xs font-bold text-stone-500 block mb-2">
                  課程進行方式與特色：
                </span>
                <div className="flex flex-wrap gap-2">
                  {(activeCourse.teachingStyle || []).map((style, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#A3E4D7]/30 text-[#14969C] border border-[#A3E4D7]"
                    >
                      ✓ {style}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* 修課心得留言區 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1F2937] flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#14969C]" />
                  <span>學長姐修課心得（{activeCourse.reviews?.length || 0} 則）</span>
                </h2>
              </div>

              {!activeCourse.reviews || activeCourse.reviews.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-200 p-10 text-center space-y-3">
                  <p className="text-stone-600 font-semibold">
                    目前還沒有這門課的心得分享喔！
                  </p>
                  <button
                    onClick={() => openContributeModal(activeCourse.id)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-[#14969C] text-white text-sm font-bold hover:bg-[#117e83] transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>成為第一位分享心得的松高人</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCourse.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#1F2937]">
                            {review.author}
                          </span>
                          {review.isSeniorBadge && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDE68A] text-amber-950">
                              <Award className="w-3.5 h-3.5 text-amber-700" />
                              松高熱心學長姐
                            </span>
                          )}
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-600">
                            {review.semester} 學期・{review.grade}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line">
                        {review.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 頁尾 */}
      <footer className="bg-white border-t border-stone-200/80 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2 font-semibold text-[#14969C]">
            <BookOpen className="w-4 h-4" />
            <span>課課相傳｜松山高中課程資訊與心得共享庫</span>
          </div>
          <p>免註冊、不打分，讓每一份真實的修課經驗都能溫暖傳承。</p>
        </div>
      </footer>

      {/* ================= 彈窗一：分享修課心得（純文字留言） ================= */}
      {isContributeOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-stone-200 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#A3E4D7]/50 text-[#14969C] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937]">分享修課心得</h3>
                  <p className="text-xs text-stone-500">免註冊直接留言，幫助學弟妹更了解這門課</p>
                </div>
              </div>
              <button
                onClick={() => setIsContributeOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  選擇課程 *
                </label>
                <select
                  value={reviewForm.courseId}
                  onChange={(e) => setReviewForm({ ...reviewForm, courseId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.teacher}）
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    修課學期
                  </label>
                  <select
                    value={reviewForm.semester}
                    onChange={(e) => setReviewForm({ ...reviewForm, semester: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  >
                    <option value="114-2">114-2 學期</option>
                    <option value="114-1">114-1 學期</option>
                    <option value="113-2">113-2 學期</option>
                    <option value="113-1">113-1 學期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    當時年級
                  </label>
                  <select
                    value={reviewForm.grade}
                    onChange={(e) => setReviewForm({ ...reviewForm, grade: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  >
                    <option value="高一">高一</option>
                    <option value="高二">高二</option>
                    <option value="高三">高三</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  你的稱呼（選填，留白則顯示「熱心松高同學」）
                </label>
                <input
                  type="text"
                  value={reviewForm.author}
                  onChange={(e) => setReviewForm({ ...reviewForm, author: e.target.value })}
                  placeholder="例如：214班 學姐、剛修完的高三生"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  修課心得與課程資訊分享 *
                </label>
                <textarea
                  rows={4}
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="聊聊這門課平常怎麼上課、有沒有分組報告或作業、對學習歷程有沒有幫助，或是給學弟妹的小建議～"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-[#14969C] hover:bg-[#117e83] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? '發佈中...' : '送出修課心得'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= 彈窗二：新增一門全新課程 ================= */}
      {isAddCourseOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-xl border border-stone-200 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#A3E4D7]/50 text-[#14969C] flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937]">新增松山高中課程</h3>
                  <p className="text-xs text-stone-500">幫大家建立新課程卡片，讓同學可以留言討論</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCourseOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCourse} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    課程名稱 *
                  </label>
                  <input
                    type="text"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                    placeholder="例如：機器人專題實作"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    授課老師 *
                  </label>
                  <input
                    type="text"
                    value={courseForm.teacher}
                    onChange={(e) => setCourseForm({ ...courseForm, teacher: e.target.value })}
                    placeholder="例如：陳大文 老師"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">課程類別</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  >
                    <option value="多元選修">多元選修</option>
                    <option value="加深加廣">加深加廣</option>
                    <option value="部定必修">部定必修</option>
                    <option value="校訂必修">校訂必修</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">適合年級</label>
                  <select
                    value={courseForm.grade}
                    onChange={(e) => setCourseForm({ ...courseForm, grade: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  >
                    <option value="高一">高一</option>
                    <option value="高二">高二</option>
                    <option value="高三">高三</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">班群屬性</label>
                  <select
                    value={courseForm.group}
                    onChange={(e) => setCourseForm({ ...courseForm, group: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#14969C]"
                  >
                    <option value="不限班群">不限班群</option>
                    <option value="自然組">自然組</option>
                    <option value="社會組">社會組</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  上課方式標籤（用逗號分隔）
                </label>
                <input
                  type="text"
                  value={courseForm.teachingStyleText}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, teachingStyleText: e.target.value })
                  }
                  placeholder="例如：分組報告, 實作作品, 無筆試"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  課程大綱與內容簡介
                </label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="簡單介紹這門課會學到什麼內容..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-[#FAFAF9] text-sm focus:outline-none focus:border-[#14969C]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-[#14969C] hover:bg-[#117e83] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? '建立中...' : '確認建立課程'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
