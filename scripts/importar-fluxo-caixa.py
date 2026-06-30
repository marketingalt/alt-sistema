#!/usr/bin/env python3
"""Import fluxo-caixa CSV data into the JSON storage file"""
import csv
import json
import os
import re
import sys
from datetime import datetime

CSV_PATH = "/tmp/fluxo-caixa-doc.csv"
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "fluxo-caixa.json")


def parse_brl(val):
    """Parse Brazilian currency like 'R$ 1.234,56' or '-R$ 100,00'"""
    if not val:
        return 0.0
    val = val.strip()
    negative = val.startswith("-")
    # Remove R$, spaces, etc
    s = re.sub(r'^R?\$?\s*', '', val, flags=re.IGNORECASE).strip()
    if s.startswith("-"):
        negative = True
        s = s.lstrip("-").strip()
    # Remove thousand separators
    s = s.replace(".", "")
    # Replace decimal comma
    s = s.replace(",", ".")
    try:
        num = float(s)
        return -num if negative else num
    except ValueError:
        return 0.0


def parse_date(d):
    """Convert DD/MM/YYYY or D/M/YYYY to YYYY-MM-DD"""
    if not d:
        return None
    d = d.strip()
    parts = d.split("/")
    if len(parts) != 3:
        return None
    try:
        return f"{int(parts[2]):04d}-{int(parts[1]):02d}-{int(parts[0]):02d}"
    except (ValueError, IndexError):
        return None


def normalize_modalidade(m):
    m = (m or "").strip().upper()
    mapping = {
        "FATURA CARTAO": "FATURA",
        "FATURA": "FATURA",
        "DÉBITO": "DÉBITO",
        "DEBITO": "DÉBITO",
        "INVESTIMENTO": "INVESTIMENTO",
        "PIX": "PIX",
        "TED": "TED",
        "BOLETO": "BOLETO",
        "TRANSFERENCIA": "TRANSFERENCIA",
        "TARIFA": "TARIFA",
    }
    return mapping.get(m, m or "PIX")


def normalize_area(a):
    area = (a or "").strip().upper()
    if "PROJETO" in area:
        return "PROJETOS"
    if "DIGITAL" in area:
        return "DIGITAL"
    if "MISTO" in area:
        return "MISTO"
    if "ESTORNO" in area:
        return "ESTORNO"
    return (a or "").strip() or "MISTO"


def normalize_categoria(c):
    cat = (c or "").strip().upper()
    if "RECEITA OPERACIONAL" in cat:
        return "RECEITA OPERACIONAL BRUTA"
    if "CUSTOS DIRETOS" in cat:
        return "CUSTOS DIRETOS DOS SERVIÇOS"
    if "DESPESAS ADM" in cat or "ADM E GERAIS" in cat:
        return "DESPESAS ADM E GERAIS"
    if "PESSOAL OPERACIONAL" in cat and "PROLABORE" not in cat:
        return "DESPESAS COM PESSOAL OPERACIONAL"
    if "PESSOAL" in cat and "PROLABORE" in cat:
        return "DESPESAS COM PESSOAL — PROLABORE"
    if "DEDUCOES" in cat or "DEDUÇÕES" in cat or "IMPOSTOS" in cat:
        return "DEDUÇÕES DA RECEITA (IMPOSTOS)"
    if "COMERCIAIS" in cat:
        return "DESPESAS COMERCIAIS"
    if "RESULTADO FINANCEIRO" in cat:
        return "RESULTADO FINANCEIRO"
    if "EMPRÉSTIMO THIEMY" in cat or "EMPRESTIMO THIEMY" in cat:
        return "EMPRÉSTIMO THIEMY"
    if "EMPRÉSTIMO FERNANDO" in cat or "EMPRESTIMO FERNANDO" in cat:
        return "EMPRÉSTIMO FERNANDO"
    if "DEVOLUÇÃO THIEMY" in cat or "DEVOLUCAO THIEMY" in cat:
        return "DEVOLUÇÃO THIEMY"
    if "DEVOLUÇÃO FERNANDO" in cat or "DEVOLUCAO FERNANDO" in cat:
        return "DEVOLUÇÃO FERNANDO"
    if "ESTORNO" in cat:
        return "ESTORNO"
    return (c or "").strip() or "DESPESAS ADM E GERAIS"


def normalize_banco(b):
    banco = (b or "").strip().upper()
    if "C6" in banco:
        return "C6 BANK"
    if "ITAU" in banco or "ITAÚ" in banco:
        return "Banco Itaú"
    if "NUBANK" in banco or banco.startswith("NU"):
        return "NUBANK"
    return (b or "").strip() or "C6 BANK"


def main():
    counter = 0
    lancamentos = []
    skipped_headers = 0
    skipped_saldo = 0
    skipped_empty = 0
    error_count = 0

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row or all(cell.strip() == "" for cell in row):
                skipped_empty += 1
                continue

            # Check header
            first_col = (row[0] or "").strip().upper()
            if first_col in ("DATA", "DATA "):
                skipped_headers += 1
                continue

            # Check SALDO carry-over row
            gasto_rec = (row[3] if len(row) > 3 else "").strip().upper()
            if gasto_rec == "SALDO":
                skipped_saldo += 1
                continue

            data_raw = row[0] if len(row) > 0 else ""
            modalidade_raw = row[1] if len(row) > 1 else ""
            banco_raw = row[2] if len(row) > 2 else ""
            valor_raw = row[4] if len(row) > 4 else ""
            area_raw = row[5] if len(row) > 5 else ""
            categoria_raw = row[6] if len(row) > 6 else ""
            obs_raw = row[7] if len(row) > 7 else ""
            desc_raw = row[8] if len(row) > 8 else ""

            data = parse_date(data_raw)
            if not data:
                error_count += 1
                continue

            valor = parse_brl(valor_raw)
            if valor == 0:
                error_count += 1
                continue

            # Combine obs + descricao
            obs = (obs_raw or "").strip()
            desc = (desc_raw or "").strip()
            if desc and desc != obs:
                obs = f"{obs} — {desc}" if obs else desc

            lancamento = {
                "id": f"fc{int(datetime.now().timestamp() * 1000)}{counter}",
                "data": data,
                "modalidade": normalize_modalidade(modalidade_raw),
                "banco": normalize_banco(banco_raw),
                "valor": valor,
                "area": normalize_area(area_raw),
                "categoria": normalize_categoria(categoria_raw),
                "obs": obs or "-",
                "createdAt": data,
            }
            lancamentos.append(lancamento)
            counter += 1

    # Sort by date
    lancamentos.sort(key=lambda l: l["data"])

    # Find initial balance from first SALDO row
    saldo_inicial = 0
    saldo_inicial_data = lancamentos[0]["data"] if lancamentos else "2025-01-01"
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            gasto_rec = (row[3] if len(row) > 3 else "").strip().upper()
            if gasto_rec == "SALDO" and row[0] and row[0].strip():
                dt = parse_date(row[0])
                if dt:
                    saldo_inicial = parse_brl(row[4] if len(row) > 4 else "0")
                    saldo_inicial_data = dt
                    break

    # Build output
    dados = {
        "saldoInicial": saldo_inicial,
        "saldoInicialData": saldo_inicial_data,
        "lancamentos": lancamentos,
    }

    # Save
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)

    bancos = sorted(set(l["banco"] for l in lancamentos))
    areas = sorted(set(l["area"] for l in lancamentos))
    cats = sorted(set(l["categoria"] for l in lancamentos))
    mods = sorted(set(l["modalidade"] for l in lancamentos))

    print(f"✅ Importação concluída!")
    print(f"   Lançamentos parseados: {counter}")
    print(f"   Erros:                 {error_count}")
    print(f"   Ignorados (headers):   {skipped_headers}")
    print(f"   Ignorados (SALDO):     {skipped_saldo}")
    print(f"   Ignorados (vazios):    {skipped_empty}")
    print(f"   Saldo inicial:         {saldo_inicial} ({saldo_inicial_data})")
    print(f"   Período:               {lancamentos[0]['data']} a {lancamentos[-1]['data']}")
    print(f"   Bancos:                {', '.join(bancos)}")
    print(f"   Áreas:                 {', '.join(areas)}")
    print(f"   Categorias:            {', '.join(cats)}")
    print(f"   Modalidades:           {', '.join(mods)}")


if __name__ == "__main__":
    main()
