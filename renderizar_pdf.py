import ctypes as c
import json
import re
import struct
import zlib
from pathlib import Path

root = Path(__file__).resolve().parent
lib = c.WinDLL(r'C:\Program Files\LibreOffice\program\pdfiumlo.dll')

def function(name, restype, args):
    f = getattr(lib, name)
    f.restype = restype
    f.argtypes = args
    return f

init = function('FPDF_InitLibrary', None, [])
destroy = function('FPDF_DestroyLibrary', None, [])
load = function('FPDF_LoadDocument', c.c_void_p, [c.c_char_p, c.c_char_p])
close = function('FPDF_CloseDocument', None, [c.c_void_p])
count = function('FPDF_GetPageCount', c.c_int, [c.c_void_p])
load_page = function('FPDF_LoadPage', c.c_void_p, [c.c_void_p, c.c_int])
close_page = function('FPDF_ClosePage', None, [c.c_void_p])
width = function('FPDF_GetPageWidth', c.c_double, [c.c_void_p])
height = function('FPDF_GetPageHeight', c.c_double, [c.c_void_p])
bitmap_new = function('FPDFBitmap_Create', c.c_void_p, [c.c_int, c.c_int, c.c_int])
bitmap_fill = function('FPDFBitmap_FillRect', None, [c.c_void_p, c.c_int, c.c_int, c.c_int, c.c_int, c.c_uint])
bitmap_buffer = function('FPDFBitmap_GetBuffer', c.c_void_p, [c.c_void_p])
bitmap_stride = function('FPDFBitmap_GetStride', c.c_int, [c.c_void_p])
bitmap_close = function('FPDFBitmap_Destroy', None, [c.c_void_p])
render = function('FPDF_RenderPageBitmap', None, [c.c_void_p, c.c_void_p, c.c_int, c.c_int, c.c_int, c.c_int, c.c_int, c.c_int])
text_load = function('FPDFText_LoadPage', c.c_void_p, [c.c_void_p])
text_count = function('FPDFText_CountChars', c.c_int, [c.c_void_p])
text_get = function('FPDFText_GetText', c.c_int, [c.c_void_p, c.c_int, c.c_int, c.c_void_p])
text_close = function('FPDFText_ClosePage', None, [c.c_void_p])

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

def png(filename, w, h, bgra, stride):
    raw = bytearray()
    for y in range(h):
        row = bgra[y * stride:y * stride + w * 4]
        raw.append(0)
        rgb = bytearray(w * 3)
        rgb[0::3], rgb[1::3], rgb[2::3] = row[2::4], row[1::4], row[0::4]
        raw.extend(rgb)
    filename.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))

init()
doc = load(str(root / 'cronograma_para_imprimir.pdf').encode('utf8'), None)
assert doc, 'Falha ao abrir o PDF.'
texts = []
try:
    assert count(doc) == 2
    for index in range(count(doc)):
        page = load_page(doc, index)
        w = 1190
        h = round(w * height(page) / width(page))
        bitmap = bitmap_new(w, h, 0)
        bitmap_fill(bitmap, 0, 0, w, h, 0xffffffff)
        render(bitmap, page, 0, 0, w, h, 0, 1)
        stride = bitmap_stride(bitmap)
        png(root / f'previa_pdf_pagina_{index + 1}.png', w, h, c.string_at(bitmap_buffer(bitmap), stride * h), stride)
        text_page = text_load(page)
        n = text_count(text_page)
        buf = c.create_string_buffer((n + 1) * 2)
        text_get(text_page, 0, n, buf)
        texts.append(buf.raw.decode('utf-16-le').rstrip('\0'))
        text_close(text_page)
        bitmap_close(bitmap)
        close_page(page)
    text = re.sub(r'\s+', ' ', ' '.join(texts))
    original = json.loads((root / 'cronograma_loja.json').read_text('utf8'))
    for task in original['tarefas']:
        assert task['tarefa'] in text, task['id'] + ': texto ausente no PDF'
    (root / 'texto_pdf.txt').write_text('\n\n'.join(texts), 'utf8')
    print('PDF verificado: 2 paginas, todas as 25 tarefas legiveis, duas previas geradas.')
finally:
    close(doc)
    destroy()
