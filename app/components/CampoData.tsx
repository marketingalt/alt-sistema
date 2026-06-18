"use client";

interface Props {
  label: string;
  value: string; // DD/MM/AAAA
  onChange: (v: string) => void;
  autoFilled?: boolean; // fundo azul + ícone lápis (campos auto-preenchidos)
  placeholder?: string;
}

function brParaInput(v: string): string {
  if (!v) return "";
  const partes = v.split("/");
  if (partes.length !== 3) return "";
  const [d, m, a] = partes;
  if (!d || !m || !a || a.length !== 4) return "";
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function inputParaBr(v: string): string {
  if (!v) return "";
  const [a, m, d] = v.split("-");
  if (!a || !m || !d) return "";
  return `${d}/${m}/${a}`;
}

export default function CampoData({ label, value, onChange, autoFilled = false, placeholder }: Props) {
  const inputValue = brParaInput(value);

  return (
    <div>
      <label className={`flex items-center gap-1 text-xs font-medium mb-1 ${autoFilled ? "text-gray-500" : "text-gray-500"}`}>
        {label}
        {autoFilled && (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
      </label>
      <div className="relative">
        <input
          type="date"
          value={inputValue}
          onChange={(e) => onChange(inputParaBr(e.target.value))}
          placeholder={placeholder}
          className={`
            w-full rounded-lg px-3 py-2 text-sm text-gray-700 border
            focus:outline-none focus:ring-2
            [&::-webkit-calendar-picker-indicator]:opacity-60
            [&::-webkit-calendar-picker-indicator]:cursor-pointer
            [&::-webkit-calendar-picker-indicator]:hover:opacity-100
            ${autoFilled
              ? "border-blue-200 bg-blue-50 focus:ring-blue-300 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.4] [&::-webkit-calendar-picker-indicator]:sepia [&::-webkit-calendar-picker-indicator]:hue-rotate-[200deg]"
              : "border-gray-200 bg-white focus:ring-[#fb4d06]/30"
            }
          `}
        />
      </div>
    </div>
  );
}
