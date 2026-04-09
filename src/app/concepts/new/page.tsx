"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NewConceptPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("concept");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, type }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("create failed:", res.status, txt);
        alert("Create failed");
        return;
      }
      // created — go back to list or to the new concept page
      router.push("/"); // change to `/concepts` or to created resource as desired
    } catch (err) {
      console.error(err);
      alert("Error creating concept");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">New Concept</h1>

      <div className="space-y-3 max-w-lg">
        <label className="block">
          <div className="text-sm font-medium">Name</div>
          <Input value={name} onChange={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Description</div>
          <Input value={description} onChange={(e) => setDescription((e.target as HTMLInputElement).value)} />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Type</div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2 border rounded-md">
            <option value="concept">Concept</option>
            <option value="person">Person</option>
            <option value="place">Place</option>
            <option value="event">Event</option>
            <option value="document">Document</option>
            <option value="idea">Idea</option>
          </select>
        </label>

        <div className="flex gap-2">
          <Button onClick={() => router.back()} variant="ghost">Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
        </div>
      </div>
    </div>
  );
}
