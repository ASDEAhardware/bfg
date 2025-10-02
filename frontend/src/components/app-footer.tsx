import Link from 'next/link';

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="mt-auto py-4 px-6 text-center text-sm text-gray-500 border-t">
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="flex-1">
          <span>© {currentYear} [Nome Azienda]</span>
        </div>
        <div className="flex-1 text-right">
          <Link href="/version" className="hover:underline">
            Version 1.0.0
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
