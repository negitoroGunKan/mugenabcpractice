import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import QuestionDisplay from './components/QuestionDisplay';
import FastPressButton from './components/FastPressButton';
import AnswerPanel from './components/AnswerPanel';
import MultipleChoicePanel from './components/MultipleChoicePanel';
import { Play, RotateCcw, AlertTriangle, LogIn, LogOut } from 'lucide-react';
import { parseAnswers } from './utils/quizLogic';

// Firebase 関連
import { auth, googleProvider, db, hasConfig } from './utils/firebase';
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
  </svg>
);

function App() {
  const [appState, setAppState] = useState('loading'); // loading, setup, standby, playing, answering, result
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [resultData, setResultData] = useState(null); // { isCorrect: boolean, message: string }
  const [isQuestionComplete, setIsQuestionComplete] = useState(false);
  const questionTimerRef = useRef(null);

  const [playMode, setPlayMode] = useState('standard'); // standard, id_search, tag_search
  const [activeTab, setActiveTab] = useState('standard'); // standard, id_search, tag_search
  const [questionCount, setQuestionCount] = useState('10');
  const [searchIdInput, setSearchIdInput] = useState('');
  const [setupError, setSetupError] = useState('');
  const [sessionResults, setSessionResults] = useState([]);
  const [revealedAnswers, setRevealedAnswers] = useState({});

  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagSearchMode, setTagSearchMode] = useState('AND');

  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editReading, setEditReading] = useState('');
  const [editTagsArray, setEditTagsArray] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // 解説機能用ステート
  const [editExplanation, setEditExplanation] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);

  // 正答率履歴・ランク変動演出用ステート
  const [quizHistory, setQuizHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('quizHistory');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [rankChange, setRankChange] = useState(null); // 'up' | 'down' | null
  
  const [user, setUser] = useState(null);

  // Firebase ログイン監視
  useEffect(() => {
    if (!hasConfig || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const [reviewList, setReviewList] = useState({}); // { [questionId]: { rank: number, addedAt: number } }
  const [generalRankList, setGeneralRankList] = useState({}); // { [questionId]: '〇' | '要復習' }
  const [reviewType, setReviewType] = useState(null); // 'random', 'bad', 'weak', 'ok', 'perfect', 'unreviewed', 'newest', 'oldest' etc
  const [reviewQuestionCount, setReviewQuestionCount] = useState('全問');

  const [editOshiji, setEditOshiji] = useState(null);

  const [showOshiji, setShowOshiji] = useState(() => {
    try {
      const stored = localStorage.getItem('showOshiji');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [playUpToOshiji, setPlayUpToOshiji] = useState(() => {
    try {
      const stored = localStorage.getItem('playUpToOshiji');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('showOshiji', JSON.stringify(showOshiji));
  }, [showOshiji]);

  useEffect(() => {
    localStorage.setItem('playUpToOshiji', JSON.stringify(playUpToOshiji));
  }, [playUpToOshiji]);

  const saveReviewList = async (newList) => {
    setReviewList(newList);
    try {
      localStorage.setItem('reviewList', JSON.stringify(newList));
      if (user && db) {
        const ref = doc(db, 'users', user.uid, 'data', 'reviewList');
        await setDoc(ref, newList);
      }
    } catch (e) {
      console.error('Failed to save reviewList', e);
    }
  };

  const saveGeneralRankList = async (newList) => {
    setGeneralRankList(newList);
    try {
      localStorage.setItem('generalRankList', JSON.stringify(newList));
      if (user && db) {
        const ref = doc(db, 'users', user.uid, 'data', 'generalRankList');
        await setDoc(ref, newList);
      }
    } catch (e) {
      console.error('Failed to save generalRankList', e);
    }
  };

  const renderMemoryStateBadge = (qId, isAnimating = false) => {
    const item = reviewList[qId];
    let label = '初見';
    let styles = {
      background: 'rgba(148, 163, 184, 0.1)',
      color: '#94a3b8',
      border: '1px solid rgba(148, 163, 184, 0.2)'
    };

    if (item) {
      const rank = item.rank || 0;
      if (rank === 0) {
        label = '未復習';
        styles = {
          background: 'rgba(203, 213, 225, 0.15)',
          color: '#cbd5e1',
          border: '1px solid rgba(203, 213, 225, 0.3)'
        };
      } else if (rank === 1) {
        label = 'BAD';
        styles = {
          background: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--error)',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        };
      } else if (rank === 2) {
        label = 'うろ覚え';
        styles = {
          background: 'rgba(251, 191, 36, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(251, 191, 36, 0.3)'
        };
      } else if (rank === 3) {
        label = 'OK';
        styles = {
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        };
      } else if (rank === 4) {
        label = '完璧';
        styles = {
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      }
    } else {
      const genRank = generalRankList[qId];
      if (genRank === '〇') {
        label = '〇';
        styles = {
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      } else {
        label = '初見';
        styles = {
          background: 'rgba(148, 163, 184, 0.1)',
          color: '#94a3b8',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        };
      }
    }

    let animationClass = '';
    if (isAnimating && rankChange === 'up') {
      animationClass = 'badge-glow-up';
    } else if (isAnimating && rankChange === 'down') {
      animationClass = 'badge-glow-down';
    }

    return (
      <span 
        className={animationClass}
        style={{
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          transition: 'all 0.3s',
          ...styles
        }}
      >
        {label}
      </span>
    );
  };

  // CSVデータの読み込み処理（初回および設定に戻る時に呼び出し）
  const loadCsvData = (callback) => {
    // キャッシュを避けるためにタイムスタンプを付与
    fetch(`/data.csv?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load data.csv');
        return res.text();
      })
      .then(csvText => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: async (results) => {
            // [タグ, 問題種類, 問題, 解答] の4カラム構成
            let validQuestions = results.data
              .filter(row => row.length >= 4 && row[2] && row[3])
              .map((row, idx) => {
                const rawAnswer = row[3].trim();
                
                // 解答よみを抽出
                let reading = '';
                const parenMatch = rawAnswer.split('※')[0].trim().match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
                if (parenMatch) {
                  reading = parenMatch[2].trim();
                } else {
                  const parsed = parseAnswers(rawAnswer);
                  reading = parsed.length > 0 ? parsed[0] : rawAnswer.split('※')[0].trim();
                }

                // 明示的な別解を抽出 ("も○" や "も〇" のパターン)
                let alt = '';
                const altRegex = /(?:「([^」]+)」|([A-Za-z0-9\u30a0-\u30ff\u3040-\u309f\u4e00-\u9faf+?-]+))(?:でも|も)[○〇]/g;
                const alts = [];
                let altMatch;
                const normalizedAnswer = rawAnswer.replace(/（/g, '(').replace(/）/g, ')');
                while ((altMatch = altRegex.exec(normalizedAnswer)) !== null) {
                  const val = (altMatch[1] || altMatch[2] || '').trim();
                  if (val) alts.push(val);
                }
                if (alts.length > 0) {
                  alt = alts.join(', ');
                }

                const rawQuestion = row[2] ? row[2].trim() : '';
                const slashMatch = rawQuestion.match(/([\/／])/);
                let cleanQuestion = rawQuestion;
                let oshiji = null;
                if (slashMatch) {
                  const slashChar = slashMatch[1];
                  oshiji = rawQuestion.indexOf(slashChar);
                  cleanQuestion = rawQuestion.replace(slashChar, '');
                }

                return {
                  '番号': (idx + 1).toString(),
                  '問題種類': row[1] ? row[1].trim() : 'ノーマル',
                  '問題': cleanQuestion,
                  '解答': rawAnswer,
                  '解答よみ': reading,
                  '別解': alt,
                  'タグ': row[0] ? row[0].trim() : '',
                  '押し字': oshiji,
                  '解説': row[4] ? row[4].trim() : ''
                };
              });

            // ログイン済みなら Firestore の編集データをマージする
            if (user && db) {
              try {
                const qColRef = collection(db, 'users', user.uid, 'questions');
                const qSnap = await getDocs(qColRef);
                const cloudQuestions = {};
                qSnap.forEach(docSnap => {
                  cloudQuestions[docSnap.id] = docSnap.data();
                });

                validQuestions = validQuestions.map(q => {
                  const cloudQ = cloudQuestions[q['番号']];
                  if (cloudQ) {
                    return {
                      ...q,
                      '問題': cloudQ.question !== undefined ? cloudQ.question : q['問題'],
                      '解答': cloudQ.answer !== undefined ? cloudQ.answer : q['解答'],
                      '解答よみ': cloudQ.reading !== undefined ? cloudQ.reading : q['解答よみ'],
                      'タグ': cloudQ.tags !== undefined ? cloudQ.tags : q['タグ'],
                      '押し字': cloudQ.oshiji !== undefined ? cloudQ.oshiji : q['押し字'],
                      '解説': cloudQ.explanation !== undefined ? cloudQ.explanation : q['解説']
                    };
                  }
                  return q;
                });
              } catch (e) {
                console.error('Failed to merge cloud questions:', e);
              }
            }
            
            const tagsSet = new Set();
            validQuestions.forEach(q => {
              if (q['タグ']) {
                const tagsList = q['タグ'].split(',').map(t => t.trim()).filter(t => t);
                tagsList.forEach(t => tagsSet.add(t));
                q._parsedTags = tagsList;
              } else {
                q._parsedTags = [];
              }
            });
            setAllTags(Array.from(tagsSet).sort());

            setAllQuestions(validQuestions);
            if (callback) callback(validQuestions);
          }
        });
      })
      .catch(err => {
        console.error(err);
        setAppState('error');
      });
  };

  const handleLogin = async () => {
    if (!auth || !googleProvider) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.warn('Popup login failed, trying redirect:', e);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.error('Redirect login failed:', redirectError);
        alert('ログインに失敗しました: ' + redirectError.message);
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      window.location.reload();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // 1. ログイン状態または初回時の CSV をロード・マージ
  useEffect(() => {
    setAppState('loading');
    loadCsvData((validQuestions) => {
      setAppState('setup');
      setQuestionCount(Math.min(10, validQuestions.length).toString());
    });

    try {
      const stored = localStorage.getItem('reviewList');
      if (stored) {
        setReviewList(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load reviewList', e);
    }

    try {
      const storedGeneral = localStorage.getItem('generalRankList');
      if (storedGeneral) {
        setGeneralRankList(JSON.parse(storedGeneral));
      }
    } catch (e) {
      console.error('Failed to load generalRankList', e);
    }
  }, [user]);

  // 2. ログイン時にクラウドデータを同期ロードする
  useEffect(() => {
    if (!user || !db) return;

    const fetchUserData = async () => {
      try {
        // 1. 復習リスト
        const reviewRef = doc(db, 'users', user.uid, 'data', 'reviewList');
        const reviewSnap = await getDoc(reviewRef);
        if (reviewSnap.exists()) {
          const cloudReviewList = reviewSnap.data();
          setReviewList(cloudReviewList);
          localStorage.setItem('reviewList', JSON.stringify(cloudReviewList));
        }

        // 2. 一般ランク
        const generalRef = doc(db, 'users', user.uid, 'data', 'generalRankList');
        const generalSnap = await getDoc(generalRef);
        if (generalSnap.exists()) {
          const cloudGeneralRankList = generalSnap.data();
          setGeneralRankList(cloudGeneralRankList);
          localStorage.setItem('generalRankList', JSON.stringify(cloudGeneralRankList));
        }

        // 3. 正答履歴
        const historyRef = doc(db, 'users', user.uid, 'data', 'quizHistory');
        const historySnap = await getDoc(historyRef);
        if (historySnap.exists()) {
          const cloudHistory = historySnap.data().history || [];
          setQuizHistory(cloudHistory);
          localStorage.setItem('quizHistory', JSON.stringify(cloudHistory));
        }
      } catch (e) {
        console.error('Failed to sync cloud data:', e);
      }
    };

    fetchUserData();
  }, [user]);

  const currentQ = questions[currentQuestionIndex];

  const is4択 = currentQ && currentQ['問題種類'] === '4択';

  const parsed4択 = useMemo(() => {
    if (!is4択 || !currentQ) return null;
    const text = currentQ['問題'];
    const parts = text.split(/\n?\(1\)/);
    const questionText = parts[0].trim();
    let choices = [];
    if (parts.length > 1) {
      const optionsText = '(1)' + parts[1];
      const match = optionsText.match(/\(1\)\s*(.*?)\s*\(2\)\s*(.*?)\s*\(3\)\s*(.*?)\s*\(4\)\s*(.*)/);
      if (match) {
        choices = [match[1].trim(), match[2].trim(), match[3].trim(), match[4].trim()];
      }
    }
    if (choices.length < 4) {
      choices = ['(1) 選択肢1', '(2) 選択肢2', '(3) 選択肢3', '(4) 選択肢4'];
    }
    const cleanAnswer = currentQ['解答'].replace(/^\(\d\)\s*/, '').trim();
    return {
      questionText,
      choices,
      cleanAnswer
    };
  }, [is4択, currentQ]);

  // 設定（メニュー）に戻る処理。最新のCSVをサーバーから再取得して同期する。
  const handleReturnToSetup = () => {
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    setAppState('loading');
    loadCsvData((validQuestions) => {
      setAppState('setup');
      setResultData(null);
      setIsQuestionComplete(false);
      setIsEditing(false);
      setShowExplanation(false);
      setRankChange(null); // ランク変動状態をリセット
      setSetupError('');
      setQuestionCount(Math.min(10, validQuestions.length).toString());
    });
  };

  const handleStartGame = () => {
    setIsQuestionComplete(false);
    setAppState('playing');
  };

  const handleFastPress = () => {
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    setAppState('answering');
  };

  const handleQuestionComplete = () => {
    if (appState === 'playing' && !isQuestionComplete) {
      setIsQuestionComplete(true);
      if (questionTimerRef.current) {
        clearTimeout(questionTimerRef.current);
      }
      questionTimerRef.current = setTimeout(() => {
        handleResult(false, '×');
      }, 5000);
    }
  };

  const handleResult = (isCorrect, message) => {
    if (questionTimerRef.current) {
      clearTimeout(questionTimerRef.current);
      questionTimerRef.current = null;
    }
    setResultData({ isCorrect, message });
    
    const currentQ = questions[currentQuestionIndex];
    if (currentQ) {
      setSessionResults(prev => {
        const updated = [...prev];
        updated[currentQuestionIndex] = {
          id: currentQ['番号'],
          question: currentQ['問題'],
          answer: currentQ['解答'],
          isCorrect: isCorrect
        };
        return updated;
      });

      // 直近正答率の履歴更新
      const qId = currentQ['番号'];
      setQuizHistory(prev => {
        let updated = [...prev, { questionId: qId, isCorrect, timestamp: Date.now() }];
        if (updated.length > 200) {
          updated = updated.slice(updated.length - 200);
        }
        try {
          localStorage.setItem('quizHistory', JSON.stringify(updated));
          if (user && db) {
            const ref = doc(db, 'users', user.uid, 'data', 'quizHistory');
            setDoc(ref, { history: updated }).catch(e => console.error('Firestore save failed:', e));
          }
        } catch (e) {
          console.error('Failed to save quizHistory', e);
        }
        return updated;
      });

      // 復習リストの更新処理
      const newList = { ...reviewList };
      const newGeneralList = { ...generalRankList };

      // 変更前のランクを数値化
      let oldRankVal = -1;
      if (newList[qId]) {
        oldRankVal = newList[qId].rank || 0;
      } else if (newGeneralList[qId] === '〇') {
        oldRankVal = 5;
      }

      const isGraduationExam = (playMode === 'review' && reviewType === 'perfect');
      const hasReviewItem = !!newList[qId];
      const generalState = hasReviewItem ? '要復習' : (newGeneralList[qId] === '〇' ? '〇' : '初見');

      if (generalState === '初見') {
        if (isCorrect) {
          newGeneralList[qId] = '〇';
        } else {
          newGeneralList[qId] = '要復習';
          newList[qId] = {
            id: qId,
            rank: 0,
            addedAt: Date.now()
          };
        }
      } else if (generalState === '〇') {
        if (isCorrect) {
          // 〇のまま
        } else {
          newGeneralList[qId] = '要復習';
          newList[qId] = {
            id: qId,
            rank: 0,
            addedAt: Date.now()
          };
        }
      } else if (generalState === '要復習') {
        const item = newList[qId];
        const currentRank = item.rank || 0;

        if (isCorrect) {
          if (isGraduationExam) {
            newGeneralList[qId] = '〇';
            delete newList[qId];
          } else {
            if (currentRank === 0) {
              item.rank = 2; // 未復習(0) ➜ うろ覚え(2)
            } else if (currentRank === 1) {
              item.rank = 2; // BAD(1) ➜ うろ覚え(2)
            } else if (currentRank === 2) {
              item.rank = 3; // うろ覚え(2) ➜ OK(3)
            } else if (currentRank === 3) {
              item.rank = 4; // OK(3) ➜ 完璧(4)
            } else if (currentRank === 4) {
              item.rank = 4; // 完璧(4)のまま維持
            }
          }
        } else {
          if (currentRank === 0) {
            item.rank = 1; // 未復習(0) ➜ BAD(1)
          } else {
            item.rank = Math.max(1, currentRank - 2);
          }
        }
      }

      // 変更後のランクを数値化
      let newRankVal = -1;
      if (newList[qId]) {
        newRankVal = newList[qId].rank || 0;
      } else if (newGeneralList[qId] === '〇') {
        newRankVal = 5;
      }

      // 変動判定
      if (newRankVal > oldRankVal) {
        setRankChange('up');
      } else if (newRankVal < oldRankVal) {
        setRankChange('down');
      } else {
        setRankChange(null);
      }

      saveReviewList(newList);
      saveGeneralRankList(newGeneralList);
    }

    setAppState('result');
    if (isCorrect) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2fe', '#4facfe', '#ff416c']
      });
    }
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex(prev => (prev + 1) % questions.length);
    setAppState('playing');
    setResultData(null);
    setIsQuestionComplete(false);
    setIsEditing(false);
    setShowExplanation(false); // 解説表示をリセット
    setRankChange(null); // ランク変動状態をリセット
  };

  const handleStartEdit = () => {
    setEditQuestion(currentQ['問題'] || '');
    
    let displayAnswer = currentQ['解答'] || '';
    const parenMatch = displayAnswer.match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
    if (parenMatch) {
      displayAnswer = parenMatch[1].trim();
    }
    setEditAnswer(displayAnswer);
    
    setEditReading(currentQ['解答よみ'] || '');
    const currentTags = currentQ['タグ'] 
      ? currentQ['タグ'].split(',').map(t => t.trim()).filter(t => t) 
      : [];
    setEditTagsArray(currentTags);
    setEditOshiji(currentQ['押し字'] !== undefined && currentQ['押し字'] !== null ? currentQ['押し字'] : null);
    setEditExplanation(currentQ['解説'] || ''); // 解説をセット
    setNewTagInput('');
    setSaveMessage('');
    setIsEditing(true);
  };

  const handleSaveChanges = () => {
    if (!editQuestion.trim() || !editAnswer.trim() || !editReading.trim()) {
      setSaveMessage('すべての項目を入力してください。');
      return;
    }

    let cleanAnswer = editAnswer.trim();
    let cleanReading = editReading.trim();

    // 1. 漢字バリデーション（読み）
    const kanjiRegex = /[\u4e00-\u9faf]/;
    if (kanjiRegex.test(cleanReading)) {
      setSaveMessage('解答のよみには漢字を含めず、ひらがな・カタカナ・英数字のみで入力してください。');
      return;
    }

    // 2. 自治体名末尾（都府県市）の安全な自動削除
    const prefecturesToStrip = ['東京都', '大阪府', '京都府'];
    const cityBlacklist = ['都市', '市', '朝市', '見本市', '闇市'];

    let mainPart = cleanAnswer;
    let insideReading = '';
    const parenMatch = cleanAnswer.match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
    if (parenMatch) {
      mainPart = parenMatch[1].trim();
      insideReading = parenMatch[2].trim();
    }

    let modifiedMain = mainPart;
    let suffixRemoved = null;

    if (mainPart.endsWith('県') && mainPart.length >= 2) {
      modifiedMain = mainPart.slice(0, -1);
      suffixRemoved = '県';
    } else if (prefecturesToStrip.includes(mainPart)) {
      modifiedMain = mainPart.slice(0, -1);
      suffixRemoved = mainPart.slice(-1);
    } else if (mainPart.endsWith('市') && mainPart !== '市') {
      const isBlacklisted = cityBlacklist.some(bl => bl !== '市' && mainPart.endsWith(bl));
      if (!isBlacklisted && mainPart.length >= 2) {
        modifiedMain = mainPart.slice(0, -1);
        suffixRemoved = '市';
      }
    }

    if (suffixRemoved) {
      const readingSuffixes = {
        '県': ['けん', 'ケン'],
        '都': ['と', 'ト'],
        '府': ['ふ', 'フ'],
        '市': ['し', 'シ'],
      };
      const pReadings = readingSuffixes[suffixRemoved] || [];
      for (const pr of pReadings) {
        if (cleanReading.endsWith(pr) && cleanReading.length > pr.length) {
          cleanReading = cleanReading.slice(0, -pr.length);
          break;
        }
      }

      if (insideReading) {
        for (const pr of pReadings) {
          if (insideReading.endsWith(pr) && insideReading.length > pr.length) {
            insideReading = insideReading.slice(0, -pr.length);
            break;
          }
        }
      }
    }

    // 再構築
    const hasKanji = kanjiRegex.test(modifiedMain);
    const isReadingDifferent = cleanReading.toLowerCase() !== modifiedMain.toLowerCase();

    if (hasKanji || isReadingDifferent) {
      cleanAnswer = `${modifiedMain}(${cleanReading})`;
    } else {
      cleanAnswer = modifiedMain;
    }

    // ステートに反映
    setEditAnswer(cleanAnswer);
    setEditReading(cleanReading);

    setIsSaving(true);
    setSaveMessage('');
    let csvQuestion = editQuestion;
    if (editOshiji !== null && editOshiji >= 0 && editOshiji <= editQuestion.length) {
      csvQuestion = editQuestion.slice(0, editOshiji) + '/' + editQuestion.slice(editOshiji);
    }

    if (user && db) {
      // ログイン時は Firestore に保存
      const qDocRef = doc(db, 'users', user.uid, 'questions', currentQ['番号']);
      setDoc(qDocRef, {
        question: csvQuestion,
        answer: cleanAnswer,
        reading: cleanReading,
        tags: editTagsArray.join(', '),
        oshiji: editOshiji,
        explanation: editExplanation
      })
      .then(() => {
        const newQ = {
          ...currentQ,
          '問題': editQuestion,
          '解答': cleanAnswer,
          '解答よみ': cleanReading,
          'タグ': editTagsArray.join(', '),
          _parsedTags: [...editTagsArray],
          '押し字': editOshiji,
          '解説': editExplanation
        };
        
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex] = newQ;
        setQuestions(updatedQuestions);
        
        setAllQuestions(prev => prev.map(q => q['番号'] === currentQ['番号'] ? newQ : q));
        
        setSaveMessage('保存しました！(クラウド)');
        setTimeout(() => {
          setIsEditing(false);
          setSaveMessage('');
        }, 1000);
      })
      .catch(err => {
        setSaveMessage(`保存に失敗しました: ${err.message}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
    } else {
      // 従来通りローカル API を叩く
      fetch('/api/update-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: currentQ['番号'],
          question: csvQuestion,
          answer: cleanAnswer,
          reading: cleanReading,
          tags: editTagsArray.join(', '),
          explanation: editExplanation
        })
      })
      .then(response => {
        return response.json().then(resData => {
          if (response.ok && resData.success) {
            const newQ = {
              ...currentQ,
              '問題': editQuestion,
              '解答': cleanAnswer,
              '解答よみ': cleanReading,
              'タグ': editTagsArray.join(', '),
              _parsedTags: [...editTagsArray],
              '押し字': editOshiji,
              '解説': editExplanation
            };
            
            const updatedQuestions = [...questions];
            updatedQuestions[currentQuestionIndex] = newQ;
            setQuestions(updatedQuestions);
            
            // 全問題リスト(allQuestions)も同様に更新して、次のゲームや復習リストに反映させる
            setAllQuestions(prev => prev.map(q => q['番号'] === currentQ['番号'] ? newQ : q));
            
            setSaveMessage('保存しました！');
            setTimeout(() => {
              setIsEditing(false);
              setSaveMessage('');
            }, 1000);
          } else {
            setSaveMessage(`保存に失敗しました: ${resData.error || '不明なエラー'}`);
          }
        });
      })
      .catch(err => {
        setSaveMessage(`保存に失敗しました: ${err.message}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
    }
  };

  const startReviewMode = (mode) => {
    const reviewKeys = Object.keys(reviewList);
    if (reviewKeys.length === 0) {
      setSetupError('復習リストに問題がありません。');
      return;
    }

    let targetQuestions = reviewKeys
      .map(id => {
        const q = allQuestions.find(item => item['番号'] === id);
        const reviewItem = reviewList[id];
        return q ? { ...q, _reviewData: reviewItem } : null;
      })
      .filter(q => q !== null);

    if (targetQuestions.length === 0) {
      setSetupError('復習対象の問題が見つかりませんでした。');
      return;
    }

    if (mode === 'bad') {
      targetQuestions = targetQuestions.filter(q => q._reviewData.rank === 1);
    } else if (mode === 'weak') {
      targetQuestions = targetQuestions.filter(q => q._reviewData.rank === 2);
    } else if (mode === 'ok') {
      targetQuestions = targetQuestions.filter(q => q._reviewData.rank === 3);
    } else if (mode === 'perfect') {
      targetQuestions = targetQuestions.filter(q => q._reviewData.rank === 4);
    } else if (mode === 'unreviewed') {
      targetQuestions = targetQuestions.filter(q => q._reviewData.rank === 0 || q._reviewData.rank === undefined);
    } else if (mode === 'newest') {
      targetQuestions.sort((a, b) => (b._reviewData.addedAt || 0) - (a._reviewData.addedAt || 0));
    } else if (mode === 'oldest') {
      targetQuestions.sort((a, b) => (a._reviewData.addedAt || 0) - (b._reviewData.addedAt || 0));
    } else if (mode === 'random') {
      targetQuestions.sort(() => Math.random() - 0.5);
    }

    if (targetQuestions.length === 0) {
      setSetupError('該当する問題がありません。');
      return;
    }

    let count = targetQuestions.length;
    if (reviewQuestionCount !== '全問') {
      count = Math.min(parseInt(reviewQuestionCount, 10), targetQuestions.length);
    }

    let finalQuestions = [...targetQuestions];
    if (mode !== 'newest' && mode !== 'oldest') {
      finalQuestions = finalQuestions.sort(() => Math.random() - 0.5);
    }

    finalQuestions = finalQuestions.slice(0, count);

    setQuestions(finalQuestions);
    setCurrentQuestionIndex(0);
    setSessionResults([]);
    setRevealedAnswers({});
    setPlayMode('review');
    setReviewType(mode);
    setSetupError('');
    setAppState('playing');
  };

  if (appState === 'loading') {
    return <div className="container flex-center" style={{ minHeight: '100vh' }}><h2>Now Loading...</h2></div>;
  }

  if (appState === 'error') {
    return (
      <div className="container flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <AlertTriangle color="var(--error)" size={48} />
        <h2>問題データの読み込みに失敗しました。</h2>
        <p>public/data.csv が存在するか確認してください。</p>
      </div>
    );
  }

  const isPlayingOrAnswering = appState !== 'setup' && appState !== 'loading' && appState !== 'summary';

  return (
    <div className="container" style={{ paddingTop: isPlayingOrAnswering ? '1rem' : '0' }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: isPlayingOrAnswering ? '1.5rem' : '2.5rem', 
        paddingTop: isPlayingOrAnswering ? '1.5rem' : '2rem', 
        position: 'relative' 
      }}>
        {isPlayingOrAnswering && (
          <button 
            className="btn" 
            onClick={handleReturnToSetup}
            style={{ 
              position: 'absolute', 
              left: '0', 
              top: '1.5rem', 
              padding: '8px 16px', 
              fontSize: '0.85rem',
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'var(--glass-border)'
            }}
          >
            設定に戻る
          </button>
        )}
        {!isPlayingOrAnswering && (
          <>
            <h1 style={{ background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '2.5rem' }}>
              早押しクイズ 練習アプリ
            </h1>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              {!hasConfig ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--error)', background: 'rgba(239,68,68,0.1)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--error)' }}>
                  ⚠️ Firebase未設定（ローカル保存中）
                </span>
              ) : user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '30px', border: '1px solid var(--glass-border)' }}>
                  {user.photoURL && (
                    <img src={user.photoURL} alt="avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                  )}
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{user.displayName}</span>
                  <button 
                    onClick={handleLogout} 
                    className="btn" 
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '0.8rem', 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                      color: 'var(--error)',
                      borderRadius: '20px',
                      height: 'auto',
                      transform: 'none',
                      boxShadow: 'none'
                    }}
                  >
                    <LogOut size={12} /> ログアウト
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin} 
                  className="btn btn-primary" 
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '0.9rem', 
                    borderRadius: '30px',
                    background: 'linear-gradient(135deg, #4285F4, #34A853)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(66, 133, 244, 0.3)'
                  }}
                >
                  <LogIn size={16} /> Googleでログイン
                </button>
              )}
            </div>
          </>
        )}
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {isPlayingOrAnswering && (
            <>
              問題 {currentQuestionIndex + 1} / {questions.length}
              {currentQ && (
                <span style={{ marginLeft: '12px', color: 'var(--accent)', fontWeight: 'bold', background: 'rgba(0, 242, 254, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
                  ID: {currentQ['番号']}
                </span>
              )}
            </>
          )}
        </p>
      </header>

      {appState === 'setup' && (
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
          {/* 直近正答率表示 */}
          {(() => {
            const historyCount = quizHistory.length;
            const correctCount = quizHistory.filter(h => h.isCorrect).length;
            const accuracyRate = historyCount > 0 ? Math.round((correctCount / historyCount) * 1000) / 10 : 0;
            const displayTitle = historyCount >= 200 ? '直近200問の正答率' : `直近${historyCount}問の正答率`;
            return (
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(0, 242, 254, 0.15)',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    📊 {displayTitle}
                  </span>
                  <span style={{ fontSize: '1.25rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                    {historyCount > 0 ? `${accuracyRate}%` : 'ー'} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({correctCount}/{historyCount})</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${accuracyRate}%`,
                    height: '100%',
                    background: 'linear-gradient(to right, #00f2fe, #4facfe)',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease-out'
                  }} />
                </div>
              </div>
            );
          })()}

          {/* Tab Selection */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--glass-border)' }}>
            {[
              { id: 'standard', label: 'スタンダード' },
              { id: 'id_search', label: 'ID検索' },
              { id: 'tag_search', label: 'タグ検索' },
              { id: 'review_list', label: '復習リスト' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSetupError(''); }}
                style={{
                  flex: 1,
                  border: 'none',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'none',
                  color: activeTab === tab.id ? '#ffffff' : 'var(--text-muted)',
                  padding: '8px 0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  boxShadow: activeTab === tab.id ? '0 2px 8px var(--primary-glow)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {setupError && (
            <div style={{ color: 'var(--error)', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
              {setupError}
            </div>
          )}

          {/* Tab Contents */}
          {activeTab === 'standard' && (
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>出題数:</span>
                <input
                  type="number"
                  min="1"
                  max={allQuestions.length}
                  value={questionCount}
                  onChange={(e) => { setQuestionCount(e.target.value); setSetupError(''); }}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-main)',
                    width: '90px',
                    fontSize: '1rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {allQuestions.length} 問</span>
              </div>

              <button
                className="btn btn-primary animate-btn"
                onClick={() => {
                  const count = parseInt(questionCount, 10);
                  if (isNaN(count) || count < 1 || count > allQuestions.length) {
                    setSetupError(`1から${allQuestions.length}の間の正しい問題数を入力してください。`);
                    return;
                  }
                  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
                  setQuestions(shuffled.slice(0, count));
                  setCurrentQuestionIndex(0);
                  setSessionResults([]);
                  setRevealedAnswers({});
                  setPlayMode('standard');
                  setReviewType(null);
                  setSetupError('');
                  setAppState('playing');
                }}
                style={{ width: '100%', padding: '10px' }}
              >
                スタート
              </button>
            </div>
          )}

          {activeTab === 'id_search' && (
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>問題ID:</span>
                <input
                  type="text"
                  value={searchIdInput}
                  onChange={(e) => { setSearchIdInput(e.target.value); setSetupError(''); }}
                  placeholder="例: 15"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-main)',
                    width: '120px',
                    fontSize: '1rem',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                className="btn btn-primary animate-btn"
                onClick={() => {
                  const targetId = searchIdInput.trim();
                  if (!targetId) {
                    setSetupError('IDを入力してください。');
                    return;
                  }
                  const question = allQuestions.find(q => q['番号'] === targetId);
                  if (!question) {
                    setSetupError(`ID: ${targetId} の問題が見つかりませんでした。`);
                    return;
                  }
                  setQuestions([question]);
                  setCurrentQuestionIndex(0);
                  setSessionResults([]);
                  setRevealedAnswers({});
                  setPlayMode('id_search');
                  setReviewType(null);
                  setSetupError('');
                  setAppState('playing');
                }}
                style={{ width: '100%', padding: '10px' }}
              >
                1問だけ開始する
              </button>
            </div>
          )}

          {activeTab === 'tag_search' && (
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* AND/OR switch */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="tagSearchMode" checked={tagSearchMode === 'AND'} onChange={() => setTagSearchMode('AND')} />
                  すべて一致 (AND)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="radio" name="tagSearchMode" checked={tagSearchMode === 'OR'} onChange={() => setTagSearchMode('OR')} />
                  いずれか一致 (OR)
                </label>
              </div>

              {/* Tags Area */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '10px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {allTags.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', width: '100%', textAlign: 'center' }}>登録タグなし</span>
                ) : (
                  allTags.map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          } else {
                            setSelectedTags([...selectedTags, tag]);
                          }
                          setSetupError('');
                        }}
                        style={{
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--accent)' : 'transparent',
                          background: isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)',
                          color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Tag Search Action */}
              <button
                className="btn btn-primary animate-btn"
                disabled={selectedTags.length === 0}
                onClick={() => {
                  const filtered = allQuestions.filter(q => {
                    const qTags = q._parsedTags || [];
                    if (tagSearchMode === 'AND') {
                      return selectedTags.every(t => qTags.includes(t));
                    } else {
                      return selectedTags.some(t => qTags.includes(t));
                    }
                  });

                  if (filtered.length === 0) {
                    setSetupError('該当する問題がありませんでした。');
                    return;
                  }

                  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
                  setQuestions(shuffled);
                  setCurrentQuestionIndex(0);
                  setSessionResults([]);
                  setRevealedAnswers({});
                  setPlayMode('tag_search');
                  setReviewType(null);
                  setSetupError('');
                  setAppState('playing');
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: selectedTags.length === 0 ? 'rgba(255,255,255,0.05)' : undefined,
                  color: selectedTags.length === 0 ? 'var(--text-muted)' : undefined,
                  cursor: selectedTags.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: selectedTags.length === 0 ? 'none' : undefined
                }}
              >
                {selectedTags.length === 0 ? 'タグを選択してください' : `開始 (該当: ${
                  allQuestions.filter(q => {
                    const qTags = q._parsedTags || [];
                    return tagSearchMode === 'AND'
                      ? selectedTags.every(t => qTags.includes(t))
                      : selectedTags.some(t => qTags.includes(t));
                  }).length
                }問)`}
              </button>
            </div>
          )}

          {activeTab === 'review_list' && (
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* 各ランクの集計 */}
              {(() => {
                const items = Object.values(reviewList);
                const total = items.length;
                const r0 = items.filter(i => i.rank === 0).length;
                const r1 = items.filter(i => i.rank === 1).length;
                const r2 = items.filter(i => i.rank === 2).length;
                const r3 = items.filter(i => i.rank === 3).length;
                const r4 = items.filter(i => i.rank === 4).length;

                return (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      復習対象: <span style={{ color: 'var(--accent)', fontSize: '1.4rem' }}>{total}</span> 問
                    </div>

                    {/* 内訳ビジュアルバー */}
                    {total > 0 && (
                      <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div title={`未復習: ${r0}問`} style={{ width: `${(r0/total)*100}%`, background: '#94a3b8' }} />
                        <div title={`BAD: ${r1}問`} style={{ width: `${(r1/total)*100}%`, background: 'var(--error)' }} />
                        <div title={`うろ覚え: ${r2}問`} style={{ width: `${(r2/total)*100}%`, background: '#fbbf24' }} />
                        <div title={`OK: ${r3}問`} style={{ width: `${(r3/total)*100}%`, background: '#3b82f6' }} />
                        <div title={`完璧: ${r4}問`} style={{ width: `${(r4/total)*100}%`, background: 'var(--success)' }} />
                      </div>
                    )}

                    {/* 各ランクの数ラベル */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8', marginRight: '4px' }}></span>未復習<br/><b>{r0}</b></div>
                      <div><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)', marginRight: '4px' }}></span>BAD<br/><b>{r1}</b></div>
                      <div><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24', marginRight: '4px' }}></span>うろ覚え<br/><b>{r2}</b></div>
                      <div><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', marginRight: '4px' }}></span>OK<br/><b>{r3}</b></div>
                      <div><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginRight: '4px' }}></span>完璧<br/><b>{r4}</b></div>
                    </div>
                  </div>
                );
              })()}

              <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.2rem 0' }} />

              {/* 出題数制限 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>復習の出題数:</span>
                <select
                  value={reviewQuestionCount}
                  onChange={(e) => setReviewQuestionCount(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="10">10 問</option>
                  <option value="20">20 問</option>
                  <option value="30">30 問</option>
                  <option value="全問">全問</option>
                </select>
              </div>

              {/* 復習開始ボタン群 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {/* 1. ランダム出題 (一番目立つボタン) */}
                <button
                  className="btn btn-primary animate-btn"
                  disabled={Object.keys(reviewList).length === 0}
                  onClick={() => startReviewMode('random')}
                  style={{
                    padding: '12px',
                    fontSize: '1.1rem',
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)',
                    color: '#ffffff',
                    fontWeight: 'bold'
                  }}
                >
                  ランダム出題
                </button>

                {/* 2. 記憶度ごと */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    className="btn animate-btn"
                    disabled={Object.values(reviewList).filter(i => i.rank === 1).length === 0}
                    onClick={() => startReviewMode('bad')}
                    style={{ padding: '8px 4px', fontSize: '0.85rem', borderColor: 'var(--error)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--error)' }}
                  >
                    苦手克服 (BAD)
                  </button>
                  <button
                    className="btn animate-btn"
                    disabled={Object.values(reviewList).filter(i => i.rank === 2).length === 0}
                    onClick={() => startReviewMode('weak')}
                    style={{ padding: '8px 4px', fontSize: '0.85rem', borderColor: '#fbbf24', background: 'rgba(251, 191, 36, 0.05)', color: '#fbbf24' }}
                  >
                    記憶の確かめ (うろ覚え)
                  </button>
                  <button
                    className="btn animate-btn"
                    disabled={Object.values(reviewList).filter(i => i.rank === 3).length === 0}
                    onClick={() => startReviewMode('ok')}
                    style={{ padding: '8px 4px', fontSize: '0.85rem', borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)', color: '#3b82f6' }}
                  >
                    記憶の定着 (OK)
                  </button>
                  <button
                    className="btn animate-btn"
                    disabled={Object.values(reviewList).filter(i => i.rank === 4).length === 0}
                    onClick={() => startReviewMode('perfect')}
                    style={{ padding: '8px 4px', fontSize: '0.85rem', borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.05)', color: 'var(--success)' }}
                  >
                    卒業試験 (完璧)
                  </button>
                </div>

                {/* 未復習の消化ボタンも設置 */}
                <button
                  className="btn animate-btn"
                  disabled={Object.values(reviewList).filter(i => i.rank === 0).length === 0}
                  onClick={() => startReviewMode('unreviewed')}
                  style={{ padding: '8px', fontSize: '0.85rem', borderColor: '#94a3b8', background: 'rgba(148, 163, 184, 0.05)', color: '#cbd5e1' }}
                >
                  未復習の消化
                </button>

                {/* 3. 順序ごと */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    className="btn animate-btn"
                    disabled={Object.keys(reviewList).length === 0}
                    onClick={() => startReviewMode('newest')}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  >
                    新しい順で
                  </button>
                  <button
                    className="btn animate-btn"
                    disabled={Object.keys(reviewList).length === 0}
                    onClick={() => startReviewMode('oldest')}
                    style={{ padding: '8px', fontSize: '0.85rem' }}
                  >
                    古い順で
                  </button>
                </div>
              </div>

              {/* 問題一覧と個別削除 */}
              {Object.keys(reviewList).length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>復習リスト一覧</div>
                  <div style={{ 
                    maxHeight: '180px', 
                    overflowY: 'auto', 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--glass-border)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {Object.keys(reviewList).map(id => {
                      const item = reviewList[id];
                      const q = allQuestions.find(item => item['番号'] === id);
                      if (!q) return null;

                      const rankLabels = ['未復習', 'BAD', 'うろ覚え', 'OK', '完璧'];
                      const rankColors = ['#94a3b8', 'var(--error)', '#fbbf24', '#3b82f6', 'var(--success)'];
                      
                      return (
                        <div key={id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '6px 8px', 
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}>
                          <div style={{ flex: 1, paddingRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ 
                              display: 'inline-block', 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              background: rankColors[item.rank || 0], 
                              color: '#fff', 
                              fontSize: '0.7rem', 
                              marginRight: '6px',
                              fontWeight: 'bold'
                            }}>
                              {rankLabels[item.rank || 0]}
                            </span>
                            {q['問題']}
                          </div>
                          <button
                            onClick={() => {
                              const newList = { ...reviewList };
                              delete newList[id];
                              saveReviewList(newList);

                              const newGeneralList = { ...generalRankList };
                              newGeneralList[id] = '〇';
                              saveGeneralRankList(newGeneralList);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              fontSize: '0.9rem'
                            }}
                            title="復習リストから削除 (手動卒業)"
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 🎯 押し字設定 */}
          <div style={{ 
            marginTop: '1.5rem', 
            paddingTop: '1.2rem', 
            borderTop: '1px solid var(--glass-border)',
            textAlign: 'left'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.8rem', color: 'var(--accent)' }}>
              🎯 押し字設定
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.9rem' }}>
                <span>押し字を表示する (以降の文字を赤字表示)</span>
                <input 
                  type="checkbox" 
                  checked={showOshiji} 
                  onChange={(e) => setShowOshiji(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.9rem' }}>
                <span>「押し字まで」モード (設定文字で出題ストップ)</span>
                <input 
                  type="checkbox" 
                  checked={playUpToOshiji} 
                  onChange={(e) => setPlayUpToOshiji(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {(appState === 'standby' || appState === 'playing' || appState === 'answering' || appState === 'result') && currentQ && (
        <>
          <div style={{ 
            marginBottom: '1rem', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '0.9rem'
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
              {currentQ['問題種類'] || '通常問題'}
            </span>
            {renderMemoryStateBadge(currentQ['番号'], appState === 'result')}
          </div>

          <QuestionDisplay 
            questionText={is4択 ? parsed4択.questionText : currentQ['問題']} 
            isPlaying={appState === 'playing'} 
            onComplete={handleQuestionComplete} 
            oshiji={currentQ['押し字']}
            showOshiji={showOshiji}
            playUpToOshiji={playUpToOshiji}
            revealFull={appState === 'result'}
          />

          {appState === 'playing' && isQuestionComplete && (
            <div className="animate-fade-in-up" style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '2rem', overflow: 'hidden' }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'var(--error)',
                animation: 'shrinkWidth 5s linear forwards'
              }} />
            </div>
          )}

          {appState === 'standby' && (
             <div className="flex-center animate-fade-in-up">
               <button className="btn btn-primary" onClick={handleStartGame}>
                 <Play size={20} /> 問題を再生
               </button>
             </div>
          )}

          {appState === 'playing' && (
            is4択 ? (
              <MultipleChoicePanel 
                choices={parsed4択.choices} 
                correctAnswer={parsed4択.cleanAnswer} 
                onResult={handleResult} 
              />
            ) : (
              <FastPressButton onFastPress={handleFastPress} />
            )
          )}

          {appState === 'answering' && (
            <AnswerPanel 
              primaryAnswer={currentQ['解答よみ']} 
              altAnswer={currentQ['別解']} 
              onResult={handleResult} 
            />
          )}

          {appState === 'result' && (
            <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', textAlign: 'center', marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '3rem', color: resultData?.isCorrect ? 'var(--accent)' : 'var(--error)', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                {resultData?.message}
              </h2>
              
              {isEditing ? (
                <div className="edit-panel animate-fade-in-up">
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>問題を編集する</span>
                    <span style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 'bold', background: 'rgba(0, 242, 254, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                      ID: {currentQ['番号']}
                    </span>
                  </h3>
                  <div className="edit-group">
                    <label className="edit-label">問題文</label>
                    <textarea 
                      className="edit-textarea" 
                      value={editQuestion} 
                      onChange={e => setEditQuestion(e.target.value)} 
                    />
                  </div>
                   <div className="edit-group">
                    <label className="edit-label">解答 (表示用・正解)</label>
                    <input 
                      type="text" 
                      className="edit-input" 
                      value={editAnswer} 
                      onChange={e => setEditAnswer(e.target.value)} 
                    />
                    {(() => {
                      const mainVal = editAnswer.split('(')[0].split('（')[0].trim();
                      const isPrefecture = ['東京都', '大阪府', '京都府'].includes(mainVal);
                      const isStripeCity = mainVal.endsWith && mainVal.endsWith('市') && mainVal !== '市' && !['都市', '朝市', '見本市', '闇市'].some(bl => mainVal.endsWith(bl));
                      const isStripePref = mainVal.endsWith && mainVal.endsWith('県') && mainVal.length >= 2;
                      
                      if (isPrefecture || isStripeCity || isStripePref) {
                        return (
                          <span style={{ color: 'var(--accent)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                            * 保存時に末尾の「市」「県」等は自動で削除されます。
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="edit-group">
                    <label className="edit-label">解答のよみ (ひらがな/カタカナ/英数字のみ)</label>
                    <input 
                      type="text" 
                      className="edit-input" 
                      value={editReading} 
                      onChange={e => {
                        setEditReading(e.target.value);
                        setSaveMessage('');
                      }} 
                    />
                    {/[\u4e00-\u9faf]/.test(editReading) && (
                      <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                        ※ よみに漢字が含まれています。ひらがな・カタカナ・英数字に修正してください。
                      </span>
                    )}
                  </div>
                  <div className="edit-group">
                    <label className="edit-label">タグ</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      {editTagsArray.map(tag => (
                        <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 242, 254, 0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', border: '1px solid var(--accent)' }}>
                          {tag}
                          <button 
                            style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', marginLeft: '4px', padding: '0 4px', fontSize: '1rem', lineHeight: '1' }}
                            onClick={() => setEditTagsArray(editTagsArray.filter(t => t !== tag))}
                            title="削除"
                          >×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="edit-input" 
                        value={newTagInput} 
                        onChange={e => setNewTagInput(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newTagInput.trim() && !editTagsArray.includes(newTagInput.trim())) {
                              setEditTagsArray([...editTagsArray, newTagInput.trim()]);
                              setNewTagInput('');
                            }
                          }
                        }}
                        placeholder="新しいタグを入力 (Enterで追加)"
                        style={{ flex: 1 }}
                      />
                      <button 
                        className="btn btn-primary" 
                        onClick={() => {
                          if (newTagInput.trim() && !editTagsArray.includes(newTagInput.trim())) {
                            setEditTagsArray([...editTagsArray, newTagInput.trim()]);
                            setNewTagInput('');
                          }
                        }}
                        style={{ padding: '8px 16px', minWidth: '80px' }}
                      >追加</button>
                    </div>
                  </div>
                  
                  <div className="edit-group">
                    <label className="edit-label">解説</label>
                    <textarea 
                      className="edit-textarea" 
                      value={editExplanation} 
                      onChange={e => setEditExplanation(e.target.value)} 
                      placeholder="この問題に対する解説を入力してください..."
                      style={{ minHeight: '80px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  
                  {/* 🎯 押し字（スラッシュ挿入）編集UI */}
                  <div className="edit-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="edit-label">
                      押し字（buzzポイント）: {editOshiji !== null ? `${editOshiji} 文字目` : '未設定'}
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      問題文中の文字をクリックして押し字（スラッシュ「/」挿入位置）を設定してください。
                    </p>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '4px', 
                      padding: '12px', 
                      background: 'rgba(0,0,0,0.3)', 
                      borderRadius: '8px', 
                      border: '1px solid var(--glass-border)',
                      userSelect: 'none',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }}>
                      {Array.from(editQuestion).map((char, index) => {
                        const isSelected = editOshiji !== null && index < editOshiji;
                        return (
                          <span 
                            key={index}
                            onClick={() => setEditOshiji(index + 1)}
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isSelected ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
                              color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                              border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                              fontSize: '0.95rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = isSelected ? 'rgba(0, 242, 254, 0.3)' : 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'rgba(0, 242, 254, 0.2)' : 'transparent'}
                          >
                            {char}
                          </span>
                        );
                      })}
                    </div>
                    {editOshiji !== null && (
                      <button 
                        className="btn" 
                        onClick={() => setEditOshiji(null)}
                        style={{ marginTop: '8px', padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}
                      >
                        押し字をクリア
                      </button>
                    )}
                  </div>

                  {saveMessage && (
                    <div style={{ color: saveMessage.includes('失敗') ? 'var(--error)' : 'var(--success)', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 'bold', textAlign: 'left' }}>
                      {saveMessage}
                    </div>
                  )}
                  <div className="edit-actions">
                    <button className="btn" onClick={() => setIsEditing(false)} disabled={isSaving}>キャンセル</button>
                    <button className="btn btn-primary" onClick={handleSaveChanges} disabled={isSaving}>
                      {isSaving ? '保存中...' : '変更を保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                   {!resultData?.isCorrect && (
                    <div style={{ marginBottom: '1.2rem', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'left' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>問題全文</p>
                      <p style={{ fontSize: '1.1rem', lineHeight: '1.4' }}>{currentQ['問題']}</p>
                    </div>
                  )}
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem 1.2rem', borderRadius: '12px', margin: '1.2rem 0' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>正解</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--success)' }}>
                      {currentQ['解答'].replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim()}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>({currentQ['解答よみ']} {currentQ['別解'] ? `/ ${currentQ['別解']}` : ''})</p>
                  </div>
                  
                  {/* 解説トグルエリア */}
                  <div style={{ margin: '1.2rem 0', textAlign: 'left' }}>
                    <button
                      className="btn"
                      onClick={() => setShowExplanation(!showExplanation)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    >
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💡 解説
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {showExplanation ? 'タップして閉じる ▲' : 'タップして表示 ▼'}
                      </span>
                    </button>
                    
                    {showExplanation && (
                      <div 
                        className="animate-fade-in-up"
                        style={{
                          marginTop: '8px',
                          padding: '1rem 1.2rem',
                          background: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid rgba(0, 242, 254, 0.15)',
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          lineHeight: '1.6',
                          color: 'var(--text-main)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all'
                        }}
                      >
                        {currentQ['解説'] ? (
                          currentQ['解説']
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            解説はまだ登録されていません。「問題を修正」から解説を追加できます。
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {questions.length > 1 ? (
                      <>
                        {currentQuestionIndex === questions.length - 1 ? (
                          <button className="btn btn-primary" onClick={() => setAppState('summary')}>
                            結果発表
                          </button>
                        ) : (
                          <button className="btn btn-primary" onClick={handleNextQuestion}>
                            <RotateCcw size={20} /> 次の問題へ
                          </button>
                        )}
                        <button className="btn edit-btn" onClick={handleStartEdit}>
                          <EditIcon /> 問題を修正
                        </button>
                        <button className="btn" onClick={handleReturnToSetup} style={{ background: 'rgba(255,255,255,0.05)' }}>
                          設定に戻る
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-primary" onClick={handleReturnToSetup}>
                          設定に戻る
                        </button>
                        <button className="btn edit-btn" onClick={handleStartEdit}>
                          <EditIcon /> 問題を修正
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {appState === 'summary' && (
        <div className="glass-panel animate-fade-in-up" style={{ padding: '2rem', width: '100%', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>結果発表</h2>
          
          {/* Simple results summary */}
          <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>
              {sessionResults.filter(r => r?.isCorrect).length} / {sessionResults.length} 問
            </div>
            <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
              正答率: {Math.round((sessionResults.filter(r => r?.isCorrect).length / (sessionResults.length || 1)) * 100)} %
            </div>
          </div>

          {/* Scrollable Questions list */}
          <div style={{ 
            maxHeight: '320px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px', 
            padding: '10px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '12px', 
            border: '1px solid var(--glass-border)',
            textAlign: 'left',
            marginBottom: '2rem'
          }}>
            {sessionResults.map((result, index) => {
              if (!result) return null;
              const isRevealed = !!revealedAnswers[index];
              return (
                <div 
                  key={index} 
                  onClick={() => {
                    setRevealedAnswers(prev => ({
                      ...prev,
                      [index]: !prev[index]
                    }));
                  }}
                  style={{ 
                    padding: '12px', 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    borderRadius: '8px', 
                    border: `1px solid ${isRevealed ? 'rgba(0, 242, 254, 0.2)' : 'var(--glass-border)'}`, 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    userSelect: 'none'
                  }}
                  className="animate-btn"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                      問 {index + 1} {result.isCorrect ? '🟢 正解' : '❌ 不正解'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ID: {result.id} | {isRevealed ? 'タップして解答を隠す' : 'タップして解答を表示'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                    {result.question}
                  </div>
                  
                  {isRevealed && (
                    <div 
                      className="animate-fade-in-up" 
                      style={{ 
                        marginTop: '10px', 
                        padding: '8px 12px', 
                        background: 'rgba(0, 242, 254, 0.1)', 
                        borderRadius: '6px', 
                        borderLeft: '3px solid var(--accent)',
                        fontSize: '0.95rem',
                        fontWeight: 'bold'
                      }}
                    >
                      <span style={{ color: 'var(--accent)', marginRight: '8px' }}>正解:</span>
                      {result.answer.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button 
            className="btn btn-primary animate-btn" 
            onClick={handleReturnToSetup}
            style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}
          >
            設定に戻る
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
