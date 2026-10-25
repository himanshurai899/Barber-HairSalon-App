import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Krishna Hair Salon uses your name and phone number.",
};

// Placeholder wording: the owner must review before launch (see issue #8).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-prose space-y-4 px-4 py-8">
      <h1 className="font-serif text-3xl">Privacy</h1>
      <p>
        When you book, we ask for your name and phone number. We use them only to manage your appointment and to
        message you about it.
      </p>
      <h2 className="font-serif text-xl">WhatsApp</h2>
      <p>
        If you message our WhatsApp number, we receive your number and profile name and may reply with a booking link.
        If you tick &quot;Send updates on WhatsApp&quot; when booking, we send you a WhatsApp message when your booking is
        confirmed or declined. Messages are sent through Meta&apos;s WhatsApp Business Platform, which processes them under
        its own terms.
      </p>
      <h2 className="font-serif text-xl">What we keep</h2>
      <p>
        We keep your name, phone number and booking history so we can look after repeat visits. We do not sell your data
        and we do not use advertising trackers.
      </p>
      <h2 className="font-serif text-xl">Your choices</h2>
      <p>
        You can cancel a booking from the private link we give you. To have your details deleted, call or message the
        salon and ask.
      </p>
    </main>
  );
}
