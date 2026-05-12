import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

/**
 * Transição de página com fade puro (sem deslocamento) e sem gap entre rotas.
 * mode="popLayout" deixa a próxima rota aparecer imediatamente, evitando o "pulo".
 */
export const PageTransition = ({ children }: Props) => {
  const location = useLocation();
  const outlet = useOutlet();
  const content = children ?? outlet;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "linear" }}
        style={{ willChange: "opacity" }}
        className="contents"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
