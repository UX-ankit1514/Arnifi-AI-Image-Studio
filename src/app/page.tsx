import { redirect } from "next/navigation";

/* The Image Library is the home screen (PRD §7.2 step 1). */
export default function Home() {
  redirect("/library");
}
