import json
import re
import time
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

URL = "https://concords.moneydj.com/z/zk/zk1/zkparse_580_240.djhtm"


class SelectionTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag == "td" and self.row is not None:
            self.cell = [dict(attrs).get("class", ""), ""]
            self.row.append(self.cell)

    def handle_endtag(self, tag):
        if tag == "td":
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None
            self.cell = None

    def handle_data(self, data):
        self.text.append(data)
        if self.cell is not None:
            self.cell[1] += data


def parse(html, today):
    table = SelectionTable()
    table.feed(html)
    match = re.search(r"日期\s*[:：]\s*(\d{1,2})/(\d{1,2})", " ".join(table.text))
    if not match:
        raise ValueError("MoneyDJ trade date missing")
    month, day = map(int, match.groups())
    date = today.replace(month=month, day=day)
    if date > today:
        date = date.replace(year=date.year - 1)
    rows = {}
    for row in table.rows:
        for i in range(len(row) - 3):
            match = re.fullmatch(r"(\d{4,6}[A-Z]?)\s*(\D.+)", row[i][1].strip())
            if not match:
                continue
            code, name = match.groups()
            try:
                close = float(row[i+1][1].strip().replace(",", ""))
                pct = float(row[i+3][1].strip().removesuffix("%"))
            except ValueError:
                continue
            if "RG" in row[i+2][0] or row[i+2][1].strip().startswith("-"):
                pct = -abs(pct)
            rows[code] = [date.isoformat(), code, name.strip(), close, pct]
    if not rows:
        raise ValueError("No valid MoneyDJ stock rows")
    return list(rows.values())


if __name__ == "__main__":
    now = datetime.now(ZoneInfo("Asia/Taipei"))
    path = Path("site/data.js")
    old = json.loads(re.fullmatch(r"const seed\s*=\s*(\[.*\])\s*;\s*", path.read_text(encoding="utf-8"), re.S)[1])
    rows = []
    error = None
    for delay in (0, 10, 30):
        time.sleep(delay)
        try:
            with urlopen(Request(URL, headers={"User-Agent": "Mozilla/5.0"}), timeout=25) as response:
                rows = parse(response.read().decode("cp950", errors="replace"), now.date())
            if rows[0][0] < max(row[0] for row in old):
                raise ValueError("Source date is older than the saved data")
            error = None
            break
        except (OSError, ValueError) as exc:
            error = exc
    if error is None:
        merged = {(r[0], r[1]): r for r in old}
        merged.update({(r[0], r[1]): r for r in rows})
        path.write_text("const seed=" + json.dumps(sorted(merged.values(), key=lambda r: r[0]), ensure_ascii=False) + ";\n", encoding="utf-8")
    status = {"checkedAt": now.isoformat(), "ok": error is None}
    Path("site/status.js").write_text("const updateStatus=" + json.dumps(status) + ";\n", encoding="utf-8")
    if error is not None:
        print(f"MoneyDJ update failed: {error}", flush=True)
        raise SystemExit(1)
