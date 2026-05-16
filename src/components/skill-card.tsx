"use client"

interface SkillCardProps {
  name: string
  description: string
  selected: boolean
  onSelect: () => void
}

export function SkillCard({ name, description, selected, onSelect }: SkillCardProps) {
  return (
    <div
      className={`bg-card border rounded-xl p-6 transition-colors duration-200 ${
        selected ? "border-accent" : "border-border hover:border-muted"
      }`}
    >
      <h3 className="text-base font-semibold text-white">{name}</h3>
      <p className="text-sm text-muted mt-2 leading-relaxed line-clamp-3">{description}</p>
      <button
        onClick={onSelect}
        className={`mt-4 w-full border rounded-lg h-9 text-sm font-medium transition-colors duration-150 ${
          selected
            ? "border-accent text-accent bg-accent/10"
            : "border-border text-muted hover:border-muted hover:text-white"
        }`}
      >
        {selected ? "Selected \u2713" : "Select"}
      </button>
    </div>
  )
}
