import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function ReportTopBar() {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }

  return (
    <div className="no-print -mb-2 flex items-center">
      <button
        type="button"
        className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-subtle hover:bg-muted hover:text-foreground"
        onClick={goBack}
      >
        <ArrowLeft className="size-[18px]" aria-hidden="true" />
        Back
      </button>
    </div>
  );
}
