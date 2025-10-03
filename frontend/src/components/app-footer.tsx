import Link from 'next/link';

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="fixed bottom-0 left-0 right-0 py-2 px-4 text-center text-xs text-muted-foreground bg-sidebar border-t border-border z-5">
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="flex-1">
          <span>© {currentYear} [Nome Azienda]</span>
        </div>
        <div className="flex-1 text-right">
          <Link href="/version" className="hover:underline hover:text-foreground transition-colors">
            Version 1.0.0
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
