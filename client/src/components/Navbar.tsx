import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, User, LogOut, Settings, Menu, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function Navbar() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 獲取未讀通知數量
  const { data: unreadCount } = trpc.alertNotifications.getUnreadCount.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 30000 } // 每 30 秒刷新
  );
  
  // 獲取最新通知（用於下拉面板）
  const { data: notifications } = trpc.alertNotifications.list.useQuery(
    { limit: 5, offset: 0 },
    { enabled: isAuthenticated }
  );
  
  const logoutMutation = trpc.auth.logout.useMutation();
  
  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };
  
  const navLinks = [
    { href: "/", label: "首頁" },
    { href: "/addresses", label: "地址排行榜" },
    { href: "/compare", label: "地址比較" },
    { href: "/markets", label: "市場列表" },
    { href: "/subscriptions", label: "警報訂閱" },
  ];
  
  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };
  
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <a className="flex items-center space-x-2 cursor-pointer">
            <span className="text-2xl font-black tracking-tight neon-glow-pink">
              BENTANA
            </span>
            <span className="text-sm font-bold tracking-widest neon-glow-cyan">
              INSIGHTS
            </span>
          </a>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <a
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(link.href) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </a>
            </Link>
          ))}
        </div>
        
        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                    <h3 className="font-semibold">通知</h3>
                    {unreadCount && unreadCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {unreadCount} 則未讀
                      </span>
                    )}
                  </div>
                  
                  {notifications && notifications.length > 0 ? (
                    <>
                      {notifications.map((notification: any) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="flex flex-col items-start p-4 cursor-pointer"
                          onClick={() => window.location.href = "/notifications"}
                        >
                          <div className="flex items-start justify-between w-full">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {notification.content}
                              </p>
                            </div>
                            {!notification.isRead && (
                              <div className="h-2 w-2 rounded-full bg-primary ml-2 mt-1" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.createdAt), {
                              addSuffix: true,
                              locale: zhTW,
                            })}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="justify-center text-primary"
                        onClick={() => window.location.href = "/notifications"}
                      >
                        查看所有通知
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">還沒有通知</p>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => window.location.href = "/subscriptions"}>
                    <Settings className="mr-2 h-4 w-4" />
                    訂閱設置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <a href={getLoginUrl()}>
              <Button>登入</Button>
            </a>
          )}
          
          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container py-4 space-y-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <a
                  className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
