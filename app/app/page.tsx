import { redirect } from 'next/navigation';

// 扁平化后控制台首页是 /projects。/app 是旧 monorepo 的控制台根路径，
// 保留此重定向以兜底任何指向 /app 的旧链接、书签或历史 session 的 returnTo。
export default function AppIndexRedirect() {
  redirect('/projects');
}
