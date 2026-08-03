import csv
import re
import pykakasi
import sys

# Force UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

csv_path = r"c:\Users\junki\OneDrive\デスクトップ\abc練習\public\data.csv"
kks = pykakasi.kakasi()

kanji_pattern = re.compile(r'[\u4e00-\u9faf]')

# 安全な削除対象：
# 「県」は無条件で末尾削除。
# 「都」「府」は「東京都」「大阪府」「京都府」のみ末尾削除。
# 「市」は「市」「都市」「朝市」「見本市」「闇市」で終わるもの以外は末尾削除。
# 「郡・区・町・村」は一切削除しない（誤変換防止のため）。

prefectures_to_strip = ("東京都", "大阪府", "京都府")
city_blacklist = ("都市", "市", "朝市", "見本市", "闇市")

def clean_and_convert_answer(answer):
    answer = answer.strip()
    
    # 1. カッコ書きの分離
    match = re.match(r'^([^(（]+)[(（]([^)）]+)[)）]$', answer)
    
    if match:
        main = match.group(1).strip()
        reading = match.group(2).strip()
        has_original_reading = True
    else:
        main = answer
        reading = None
        has_original_reading = False

    # 2. 行政区分名の安全な除去
    modified_main = main
    suffix_removed = None
    
    if main.endswith('県') and len(main) >= 2:
        modified_main = main[:-1]
        suffix_removed = '県'
    elif main in prefectures_to_strip:
        modified_main = main[:-1]
        suffix_removed = main[-1]
    elif main.endswith('市') and main != '市':
        is_blacklisted = False
        for bl in city_blacklist:
            if bl != '市' and main.endswith(bl):
                is_blacklisted = True
                break
        if not is_blacklisted and len(main) >= 2:
            modified_main = main[:-1]
            suffix_removed = '市'

    # 読みの末尾も対応する読みがあれば削る
    if suffix_removed and reading:
        reading_suffixes = {
            '県': ('けん', 'ケン'),
            '都': ('と', 'ト'),
            '府': ('ふ', 'フ'),
            '市': ('し', 'シ'),
        }
        possible_readings = reading_suffixes.get(suffix_removed, ())
        for r in possible_readings:
            if reading.endswith(r):
                if len(reading) > len(r):
                    reading = reading[:-len(r)]
                break

    # 3. 読みの自動生成またはフォーマット
    has_kanji = bool(kanji_pattern.search(modified_main))
    
    if has_kanji:
        if not reading:
            result = kks.convert(modified_main)
            reading = "".join([item['hira'] for item in result])
        return f"{modified_main}({reading})"
    else:
        if reading and has_original_reading:
            return f"{modified_main}({reading})"
        else:
            return modified_main

# CSVデータを読み込み、変換して上書き保存
rows = []
modified_count = 0

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        if len(row) >= 4:
            q_type = row[1].strip()
            if q_type != '4択':
                original_answer = row[3]
                converted_answer = clean_and_convert_answer(original_answer)
                if original_answer != converted_answer:
                    row[3] = converted_answer
                    modified_count += 1
        rows.append(row)

# 上書き保存
with open(csv_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(f"Successfully processed CSV securely.")
print(f"Total rows: {len(rows)}")
print(f"Modified rows: {modified_count}")
