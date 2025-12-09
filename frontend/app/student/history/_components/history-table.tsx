"use client";

import { useState } from "react";
import {
  Eye,
  Trash2,
  MoreVertical,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HistoryPreview } from "./history-preview";
import { deleteStudentConversation } from "../action";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface Conversation {
  id: string;
  title: string;
  messages: string;
  createdAt: Date;
  updatedAt: Date;
}

interface HistoryTableProps {
  conversations: Conversation[];
  onDelete?: () => void;
}

export function HistoryTable({
  conversations,
  onDelete,
}: HistoryTableProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handlePreview = (id: string) => {
    setPreviewId(id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    setIsDeleting(id);
    try {
      const result = await deleteStudentConversation(id);
      if (result.success) {
        toast.success("Conversation deleted successfully");
        onDelete?.();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete conversation");
      }
    } catch (error) {
      toast.error("Failed to delete conversation");
      console.error("Error deleting conversation:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const previewConversation = conversations.find((c) => c.id === previewId);

  const getPreviewContent = (messagesJson: string) => {
    try {
      const parsed = JSON.parse(messagesJson);
      const contentParts: string[] = [];

      parsed.forEach((msg: any) => {
        if (msg.role === "user") {
          contentParts.push(`**User:** ${msg.content}`);
        } else if (msg.role === "assistant") {
          contentParts.push(`**Assistant:** ${msg.content}`);
        }
      });

      return contentParts.join("\n\n");
    } catch {
      return "";
    }
  };

  const getSources = (messagesJson: string) => {
    try {
      const parsed = JSON.parse(messagesJson);
      const sources: Array<{ href: string; title: string }> = [];

      parsed.forEach((msg: any) => {
        if (msg.sources && Array.isArray(msg.sources)) {
          sources.push(...msg.sources);
        }
      });

      return sources;
    } catch {
      return [];
    }
  };

  const getLastMessage = (messagesJson: string) => {
    try {
      const parsed = JSON.parse(messagesJson);
      if (parsed.length > 0) {
        const lastMsg = parsed[parsed.length - 1];
        const content = lastMsg.content || "";
        return content.length > 60 ? content.substring(0, 60) + "..." : content;
      }
      return "";
    } catch {
      return "";
    }
  };

  const getMessageCount = (messagesJson: string) => {
    try {
      const parsed = JSON.parse(messagesJson);
      return parsed.length;
    } catch {
      return 0;
    }
  };

  const getAvatarInitials = (title: string) => {
    const words = title.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const userName = session?.user?.name || "Student";
  const userEmail = session?.user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-primary font-semibold">Title</TableHead>
              <TableHead className="text-primary font-semibold">User</TableHead>
              <TableHead className="text-primary font-semibold">
                Messages
              </TableHead>
              <TableHead className="text-primary font-semibold">
                Last Updated
              </TableHead>
              <TableHead className="text-right text-primary font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No conversations found
                </TableCell>
              </TableRow>
            ) : (
              conversations.map((conversation) => {
                const lastMessage = getLastMessage(conversation.messages);
                const messageCount = getMessageCount(conversation.messages);
                const avatarInitials = getAvatarInitials(conversation.title);
                const formattedDate = new Date(
                  conversation.updatedAt
                ).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <TableRow
                    key={conversation.id}
                    className="hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary border border-primary/20">
                            {avatarInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-primary truncate">
                            {conversation.title}
                          </span>
                          {lastMessage && (
                            <span className="text-sm text-muted-foreground truncate mt-0.5">
                              {lastMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-foreground">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground truncate">
                            {userName}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {userEmail}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {messageCount}{" "}
                          {messageCount === 1 ? "message" : "messages"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formattedDate}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(conversation.id)}
                          title="Preview"
                          className="hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="More options"
                              className="hover:text-primary"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDelete(conversation.id)}
                              disabled={isDeleting === conversation.id}
                              className="text-destructive focus:text-destructive"
                            >
                              {isDeleting === conversation.id ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                  Deleting...
                                </div>
                              ) : (
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {previewConversation && (
        <HistoryPreview
          open={!!previewId}
          onOpenChange={(open) => !open && setPreviewId(null)}
          title={previewConversation.title}
          content={getPreviewContent(previewConversation.messages)}
          sources={getSources(previewConversation.messages)}
        />
      )}
    </>
  );
}

