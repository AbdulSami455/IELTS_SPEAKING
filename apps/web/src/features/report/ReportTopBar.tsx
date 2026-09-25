import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";

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
    <div className="report-topbar no-print">
      <button type="button" className="report-back-btn" onClick={goBack}>
        <Icon name="arrowLeft" size={18} />
        Back
      </button>
    </div>
  );
}
