import { Icon } from "../../components/ui/Icon";

export function NextQuestionLoader({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="next-question-loader stack" role="status" aria-live="polite">
      <div className="next-question-loader__visual" aria-hidden="true">
        <span className="loader-orbit loader-orbit--a" />
        <span className="loader-orbit loader-orbit--b" />
        <span className="loader-core">
          <Icon name="spark" size={22} />
        </span>
      </div>
      <div className="stack-sm next-question-loader__copy">
        <p className="kicker">Next question</p>
        <h3>{title}</h3>
        <p className="muted">{hint}</p>
      </div>
    </div>
  );
}
