import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

/**
 * Envolve cada rota com fade+slide curtos para evitar trocas bruscas.
 * Funciona tanto com children diretos quanto via <Outlet />.
 */
export const PageTransition = ({ children }: Props) => {
  const location = useLocation();
  const outlet = useOutlet();
  const content = children ?? outlet;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="contents"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
