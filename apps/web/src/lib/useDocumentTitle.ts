import { PRODUCT_FULL } from "../features/marketing/site";
import { useEffect } from "react";

const APP_NAME = PRODUCT_FULL;

export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
