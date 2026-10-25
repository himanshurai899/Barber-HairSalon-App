import { StaffShell } from "@/components/staff-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <StaffShell
      roles={["admin"]}
      links={[
        ["/admin", "Dashboard"],
        ["/admin/barbers", "Barbers"],
        ["/admin/services", "Services"],
        ["/admin/hours", "Hours"],
        ["/admin/users", "Users"],
      ]}
    >
      {children}
    </StaffShell>
  );
}
