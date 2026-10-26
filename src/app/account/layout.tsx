import { StaffShell } from "@/components/staff-shell";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <StaffShell roles={["barber", "admin"]} links={[]}>
      {children}
    </StaffShell>
  );
}
