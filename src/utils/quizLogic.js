const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽぁぃぅぇぉっゃゅょ";
const KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポァィゥェォッャュョ";
const ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function getCharType(char, input = '', validAnswers = []) {
  if (char === 'ー') {
    // 伸ばし棒の場合、前後の文字からひらがな・カタカナを判断
    // 1. 前の文字を確認
    if (input && input.length > 0) {
      const prevChar = input[input.length - 1];
      if (HIRAGANA.includes(prevChar)) return 'hiragana';
      if (KATAKANA.includes(prevChar)) return 'katakana';
    }
    // 2. 後ろの文字を確認
    const index = input.length;
    for (const ans of validAnswers) {
      if (ans.length > index + 1) {
        const nextChar = ans[index + 1];
        if (HIRAGANA.includes(nextChar)) return 'hiragana';
        if (KATAKANA.includes(nextChar)) return 'katakana';
      }
    }
    // 3. 判定できない場合はデフォルトでカタカナ
    return 'katakana';
  }

  if (HIRAGANA.includes(char)) return 'hiragana';
  if (KATAKANA.includes(char)) return 'katakana';
  if (/[A-Z]/.test(char)) return 'uppercase';
  if (/[a-z]/.test(char)) return 'lowercase';
  if (/[0-9]/.test(char)) return 'number';

  return 'hiragana'; // デフォルト
}

function getRandomChar(type) {
  let source = HIRAGANA;
  if (type === 'katakana') source = KATAKANA;
  else if (type === 'uppercase') source = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  else if (type === 'lowercase') source = "abcdefghijklmnopqrstuvwxyz";
  else if (type === 'number') source = "0123456789";
  
  const randomIndex = Math.floor(Math.random() * source.length);
  return source[randomIndex];
}

/**
 * 4つの選択肢を生成する。
 * @param {string[]} validNextChars - 正解となる次の文字の配列（別解がある場合は複数）
 * @param {string} input - これまでに入力された文字列
 * @param {string[]} validAnswers - 現在有効な答えのリスト
 * @returns {string[]} シャッフルされた4つの選択肢
 */
export function generateChoices(validNextChars, input = '', validAnswers = []) {
  // 正解の文字をセットにする（重複排除）
  const correctChars = Array.from(new Set(validNextChars));
  
  const choices = [...correctChars];
  
  // 正解文字それぞれの文字タイプを判定
  const correctTypes = correctChars.map(char => getCharType(char, input, validAnswers));
  
  if (correctTypes.length === 0) {
    correctTypes.push('hiragana');
  }

  // 4つになるまでダミー文字を追加
  let typeIndex = 0;
  while (choices.length < 4) {
    const currentType = correctTypes[typeIndex % correctTypes.length];
    const dummy = getRandomChar(currentType);
    if (!choices.includes(dummy)) {
      choices.push(dummy);
    }
    typeIndex++;
  }

  // もし正解文字が4つを超えている異常系があれば切り詰める
  if (choices.length > 4) {
    choices.length = 4;
  }

  // シャッフルして返す
  return choices.sort(() => Math.random() - 0.5);
}

/**
 * 現在の入力に対して、正解パスがまだ生きているかを判定する。
 * @param {string} input - これまで入力した文字列
 * @param {string[]} answers - 可能な答えの配列（メイン解答、別解など）
 * @returns {string[]} まだ可能性として残っている答えの配列
 */
export function getValidAnswers(input, answers) {
  return answers.filter(ans => ans.startsWith(input));
}

/**
 * 現在の入力状態で、次に入力可能な正解の文字一覧を取得する。
 * @param {string} input - これまで入力した文字列
 * @param {string[]} validAnswers - まだ可能性として残っている答えの配列
 * @returns {string[]} 次に入力すべき文字の配列
 */
export function getValidNextChars(input, validAnswers) {
  const nextChars = validAnswers.map(ans => ans[input.length]);
  return Array.from(new Set(nextChars));
}

/**
 * 解答文字列を解析し、許容される正解（読み仮名、および明示的な別解）の配列を返す。
 * 漢字や英語などの外側の表記は除外し、「よみ」だけを正解とします。
 * @param {string} answerStr - 解答文字列
 * @returns {string[]} 有効な別解リスト
 */
export function parseAnswers(answerStr) {
  if (!answerStr) return [];
  const results = new Set();

  // カッコ（半角・全角、角カッコ、隅付きカッコ）を半角丸カッコに統一
  let normalized = answerStr
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/［/g, '(').replace(/］/g, ')')
    .replace(/\[/g, '(').replace(/\]/g, ')')
    .replace(/【/g, '(').replace(/】/g, ')')
    .trim();

  // 1. 別解の抽出 ("も○" や "も〇" のパターン)
  const altAnswers = [];
  const altRegex = /(?:「([^」]+)」|([A-Za-z0-9\u30a0-\u30ff\u3040-\u309f\u4e00-\u9faf+?-]+))(?:でも|も)[○〇]/g;
  let altMatch;
  while ((altMatch = altRegex.exec(normalized)) !== null) {
    const val = (altMatch[1] || altMatch[2] || '').trim();
    if (val) {
      altAnswers.push(val);
    }
  }

  // 2. 本解（メインの答え）の抽出
  let mainPart = normalized.split('※')[0].trim();
  
  // 囲み記号の除去
  mainPart = mainPart.replace(/[「」『』""'’“”]/g, '').trim();

  let mainReadings = [];

  const isEnglishOrLatin = (text) => {
    return /[A-Za-z0-9À-ÿ\u0100-\u024f]/.test(text) && !/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
  };
  
  if (mainPart.includes('(')) {
    // カッコの直前にある漢字・英語部分を置換
    const rubiRegex = /([/／@＠!,，.．\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ffA-Za-z0-9_＿・．. \-－&＆#＃*＊+＋]+)\(([^)]*)\)/g;
    let rubiReplaced = mainPart.replace(rubiRegex, (match, p1, p2) => {
      const cleanP1 = p1.trim();
      const cleanP2 = p2.split(/[，,、／/]/)[0].trim();
      
      const isP2Kana = /^[0-9\u3040-\u309f\u30a0-\u30ff\s・．.、,／/()\-－＆&・]+$/.test(cleanP2);
      const isP1English = isEnglishOrLatin(cleanP1);

      // A. カタカナ英語パターン (例: Suica(スイカ), ZOZOTOWN(ゾゾタウン), UEFA(ウエファ))
      if (isP1English && isP2Kana) {
        return cleanP2; // カッコ内のカタカナを優先
      }
      
      // B. 通常の漢字ルビ (例: 怒髪(どはつ))
      const isP1Kanji = /[\u4e00-\u9faf]/.test(cleanP1);
      if (isP1Kanji && isP2Kana) {
        return cleanP2; // ひらがなルビを優先
      }

      // C. 英語原綴パターン (例: ダゲレオタイプ(daguerreotype), アリストテレス(Aristotelēs))
      const isP2English = isEnglishOrLatin(cleanP2);
      const isP1Japanese = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/.test(cleanP1);
      if (isP2English && isP1Japanese) {
        return cleanP1; // 外側の日本語を優先
      }

      // D. 大文字略称パターン (例: WHO, MIDI)
      const isP1Abbreviation = /^[A-Z0-9\s\-&＆/]{2,}$/.test(cleanP1);
      if (isP1Abbreviation) {
        return cleanP1; // 英語表記を優先
      }
      
      // デフォルトは元の表記（外側）を残す (補足説明などのカッコを壊さないため)
      return cleanP1;
    });
    
    rubiReplaced = rubiReplaced.replace(/\(.*?\)/g, '').trim();
    if (rubiReplaced) {
      mainReadings.push(rubiReplaced);
    }
    
    // カッコ内のテキストそのものも別個に追加（単純なルビ抽出用）
    const regex = /\(([^)]*)\)/g;
    let match;
    while ((match = regex.exec(mainPart)) !== null) {
      const insideText = match[1].trim();
      const parts = insideText.split(/[，,、／/]/);
      parts.forEach(p => {
        const cleanP = p.trim();
        const isCleanPKana = /^[0-9\u3040-\u309f\u30a0-\u30ff\s・．.、,／/()\-－＆&・]+$/.test(cleanP);
        if (cleanP && isCleanPKana) {
          mainReadings.push(cleanP);
        }
      });
    }
  } else {
    // カッコがない場合はそのままよみとする
    mainReadings.push(mainPart);
  }

  // 3. 変換と追加
  const addResult = (text) => {
    if (!text) return;
    const val = text.trim();
    results.add(val);
    
    // 中黒やスペース、記号を除去したものも追加
    const cleanVal = val.replace(/[・\s－『』「」""'-]/g, '');
    if (cleanVal) results.add(cleanVal);
  };

  mainReadings.forEach(r => addResult(r));
  
  altAnswers.forEach(alt => {
    if (alt.includes('(')) {
      const altOutside = alt.replace(/\(.*?\)/g, '').trim();
      if (altOutside) addResult(altOutside);
      const altInsideMatches = alt.matchAll(/\(([^)]*)\)/g);
      for (const m of altInsideMatches) {
        if (m[1]) addResult(m[1]);
      }
    } else {
      addResult(alt);
    }
  });

  // 英数字はすべて小文字も許容
  const list = Array.from(results);
  list.forEach(item => {
    const lower = item.toLowerCase();
    if (lower !== item) {
      results.add(lower);
    }
  });

  return Array.from(results).filter(x => x && x.length > 0);
}
