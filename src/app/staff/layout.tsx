import { StaffShell } from "@/components/staff-shell";

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <StaffShell roles={["barber", "admin"]} links={[["/staff", "Requests"], ["/account/password", "Password"]]}>
      {children}
    </StaffShell>
  );
}
