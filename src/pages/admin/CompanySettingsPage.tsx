import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { companyService } from "@/services/company/companyService";

export function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const company = useQuery({
    queryKey: ["company"],
    queryFn: () => companyService.getCompany(),
  });

  useEffect(() => {
    if (company.data?.name) setName(company.data.name);
  }, [company.data?.name]);

  const onSave = async () => {
    if (name.trim().length < 2) {
      toast.error("Enter a company name");
      return;
    }
    setIsSaving(true);
    try {
      const logoPath = logo ? await companyService.uploadLogo(logo) : undefined;
      await companyService.save(name.trim(), logoPath);
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      setLogo(null);
      toast.success("Company details saved");
    } catch (cause) {
      toast.error("Could not save", {
        description: cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (company.isLoading) return <LoadingState label="Loading company details…" />;
  if (company.isError) {
    return (
      <ErrorState
        description="We could not load your company details."
        onRetry={() => void company.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company settings"
        description="Your company name and logo appear across the Dayflow workspace."
      />

      <div className="space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-logo">Company logo</Label>
          {company.data?.logoUrl ? (
            <img
              src={company.data.logoUrl}
              alt={`${company.data.name} logo`}
              className="h-14 w-auto rounded-md border border-border bg-background p-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No logo uploaded yet.</p>
          )}
          <Input
            id="company-logo"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="max-w-md"
            onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
          />
        </div>

        <Button onClick={() => void onSave()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
