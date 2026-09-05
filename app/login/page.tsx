import { AuthPanel } from "@/components/AuthPanel";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-white">
      <header className="mx-auto h-[164px] max-w-[1440px] px-6 py-14 sm:px-20">
        <a href="/" className="text-[22px] font-medium">@Risk_Tester</a>
        <AuthPanel initialMode="login" initialOpen />
      </header>
    </main>
  );
}
