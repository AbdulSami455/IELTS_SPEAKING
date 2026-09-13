import { Link, useNavigate } from "react-router-dom";
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
    <header className="report-topbar no-print">
      <button type="button" className="report-back-btn" onClick={goBack}>
        <Icon name="arrow" size={18} style={{ transform: "rotate(180deg)" }} />
        Back
      </button>
      <Link to="/" className="report-topbar-link">
        <Icon name="home" size={17} />
        Overview
      </Link>
    </header>
  );
}
