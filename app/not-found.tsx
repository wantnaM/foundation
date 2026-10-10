import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404 / NOT FOUND</p>
      <h1 className="text-3xl font-semibold">这个页面还不存在</h1>
      <p className="text-muted-foreground">
        检查访问地址，或回到框架首页继续。
      </p>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </main>
  );
}
