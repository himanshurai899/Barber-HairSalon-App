import { StaffShell } from "@/components/staff-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <StaffShell
      roles={["admin"]}
      links={[
        ["/admin", "Dashboard"],
        ["/admin/bookings", "Bookings"],
        ["/admin/clients", "Clients"],
        ["/admin/barbers", "Barbers"],
        ["/admin/services", "Services"],
        ["/admin/hours", "Hours"],
        ["/admin/notices", "Notices"],
        ["/admin/settings", "Settings"],
        ["/admin/users", "Users"],
      ]}
    >
      {children}
    </StaffShell>
  );
}
