import { StaffShell } from "@/components/staff-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <StaffShell
      roles={["admin"]}
      links={[
        ["/admin", "Dashboard"],
        ["/admin/users", "Users"],
      ]}
    >
      {children}
    </StaffShell>
  );
}
