from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parent
VIEWS = {
    "iphone-375": (5, 190, 375),
    "iphone-390": (5, 190, 375),
    "iphone-393": (5, 190, 375),
    "iphone-430": (5, 190, 375),
    "tablet-768": (3, 410, 360),
    "desktop-1366": (3, 455, 285),
}
ROUTES = [
    "login", "dashboard", "sales", "products", "customers", "orders", "cash",
    "credits", "reports", "receipts", "backup", "settings", "audit", "diagnostics", "coupons",
]


def build_sheet(files: list[Path], output: Path, columns: int, tile_w: int, tile_h: int) -> None:
    rows = (len(files) + columns - 1) // columns
    canvas = Image.new("RGB", (columns * tile_w, rows * tile_h), "#e8edf4")
    draw = ImageDraw.Draw(canvas)
    for index, file in enumerate(files):
        x = (index % columns) * tile_w
        y = (index // columns) * tile_h
        label = file.parent.name + "/" + file.stem
        draw.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), outline="#718096", width=1)
        draw.text((x + 7, y + 7), label[:56], fill="#102747")
        with Image.open(file) as source:
            thumb = ImageOps.contain(source.convert("RGB"), (tile_w - 12, tile_h - 34))
        px = x + (tile_w - thumb.width) // 2
        py = y + 30 + (tile_h - 34 - thumb.height) // 2
        canvas.paste(thumb, (px, py))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True)


for view, (columns, tile_w, tile_h) in VIEWS.items():
    pass2_files = []
    for route in ROUTES:
        folder = ROOT / view / route
        candidates = sorted(folder.glob("*pass2.png"))
        if candidates:
            pass2_files.append(candidates[0])
    build_sheet(pass2_files, ROOT / "contact-sheets" / f"{view}-pass2-contact.png", columns, tile_w, tile_h)

    modal_files = sorted((ROOT / view).glob("**/modal-*.png"))
    modal_files += sorted((ROOT / view / "overlays").glob("*.png"))
    if modal_files:
        build_sheet(modal_files, ROOT / "contact-sheets" / f"{view}-modals-contact.png", columns, tile_w, tile_h)
