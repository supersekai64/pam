import { Label } from '@/components/workbench-primitives'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { memoryTypes, typeHints } from '@/lib/ui-copy'

export function TagField({
  disabled = false,
  onTagsChange,
  tags,
}: {
  disabled?: boolean
  onTagsChange: (value: string) => void
  tags: string
}) {
  return (
    <Label text="Tags">
      <Input
        className="border-border bg-background/60 text-foreground"
        disabled={disabled}
        name="tags"
        value={tags}
        onChange={(event) => onTagsChange(event.target.value)}
      />
    </Label>
  )
}

export function TypeScopeFields({ disabled = false, type }: { disabled?: boolean; type: string }) {
  return (
    <div className="grid gap-3">
      <Label
        text="Type"
        hint="Category of memory. Determines how PAMH treats it: decision/knowledge/rule/preference are durable; session/task/mistake/pattern have specialized lifecycles."
      >
        <Select defaultValue={type} disabled={disabled} name="type">
          <SelectTrigger className="w-full border-border bg-background/60 text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memoryTypes.map((item) => (
              <SelectItem key={item} value={item} title={typeHints[item]}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
    </div>
  )
}
