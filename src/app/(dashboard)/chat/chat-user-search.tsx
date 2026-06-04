"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Search, Users } from "lucide-react";
import { startConversation } from "@/app/(dashboard)/chat/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, PANEL_CLASSNAME } from "@/lib/utils";

interface ChatSearchUser {
  id: string;
  fullName: string;
  email: string;
  departmentName: string | null;
}

interface ChatUserSearchProps {
  users: ChatSearchUser[];
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return initials || "U";
}

export function ChatUserSearch({ users }: ChatUserSearchProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    const source = normalizedQuery
      ? users.filter((user) =>
          [user.fullName, user.email, user.departmentName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : users;

    return source.slice(0, 8);
  }, [normalizedQuery, users]);

  return (
    <section className={cn(PANEL_CLASSNAME, "space-y-4 p-5")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary" />
            Buscar companeros
          </div>
          <p className="text-sm text-muted-foreground">
            Abre un chat directo y, si encaja, envia una propuesta privada.
          </p>
        </div>
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, email o departamento"
            className="pl-9"
          />
        </div>
      </div>

      {users.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-5 text-sm text-muted-foreground">
          No hay usuarios aprobados disponibles para iniciar chat.
        </p>
      ) : filteredUsers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-4 py-5 text-sm text-muted-foreground">
          No encontramos nadie con esa busqueda.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/90 px-4 py-3"
            >
              <Avatar className="size-10 rounded-xl">
                <AvatarFallback className="rounded-xl bg-secondary text-foreground">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              {user.departmentName && (
                <Badge variant="outline" className="hidden text-foreground sm:inline-flex">
                  {user.departmentName}
                </Badge>
              )}
              <form action={startConversation}>
                <input type="hidden" name="other_user_id" value={user.id} />
                <Button type="submit" size="sm" variant="outline">
                  <MessageSquare className="size-4" />
                  Chat
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
