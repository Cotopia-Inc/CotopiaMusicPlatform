import { Fragment } from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts = text.split(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline break-all"
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}
