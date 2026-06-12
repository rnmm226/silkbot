"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function AlertDialogWithMedia() {
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (nextOpen) {
      setShareUrl(window.location.href)
      setCopied(false)
      setCopyError("")
    }
  }

  const handleCopyLink = async () => {
    const link = shareUrl || window.location.href

    try {
      await navigator.clipboard.writeText(link)
      setShareUrl(link)
      setCopied(true)
      setCopyError("")
    } catch {
      setShareUrl(link)
      setCopied(false)
      setCopyError("Copy failed. You can select the link manually.")
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Share Conversation</Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <LinkIcon className="h-12 w-12" />
          </div>

          <AlertDialogTitle>
            Share this conversation
          </AlertDialogTitle>

          <AlertDialogDescription>
            Copy this link to share the current conversation. The person may need to sign in to open it.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Input
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Conversation share link"
            className="font-mono text-xs"
          />
          {copied && (
            <p className="text-xs text-muted-foreground">Link copied.</p>
          )}
          {copyError && (
            <p className="text-xs text-destructive">{copyError}</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <Button onClick={handleCopyLink}>
            {copied ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
