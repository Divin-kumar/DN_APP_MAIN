import zipfile
import re
from pathlib import Path

p = Path(r"C:\Users\u1221157\Desktop\Divin\Personal\Web Application\LifeHub_PROD_3rd.docx")
with zipfile.ZipFile(p) as z:
    text = z.read("word/document.xml").decode("utf-8", errors="ignore")

clean = re.sub(r"<[^>]+>", "\n", text)
clean = clean.replace("&nbsp;", " ")
replacements = {"&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'"}
for source, target in replacements.items():
    clean = clean.replace(source, target)

lines = [re.sub(r"\s+", " ", line).strip() for line in clean.splitlines()]
lines = [line for line in lines if line]
print("\n".join(lines[:500]))
