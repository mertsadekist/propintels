"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ContactStep, type ContactData } from "@/components/public/contact-step";
import { PropertyStep } from "@/components/public/property-step";
import type { PropertyData } from "@/components/public/property-step";
import { ResultsStep } from "@/components/public/results-step";
import type { ValuationResult } from "@/components/public/results-step";
import { WizardProgress } from "@/components/public/wizard-progress";
import { TokenInvalidCard } from "@/components/public/token-invalid-card";
import { WizardSkeleton } from "@/components/public/wizard-skeleton";

export type WizardStep = "contact" | "property" | "results";

interface ProjectMeta {
  id: string;
  name: string;
  location?: string;
  category: string;
  defaultType?: string;
  currency?: string;
}

type TokenState = "loading" | "valid" | "invalid" | "expired";

export default function PublicValuationPage() {
  const params = useParams();
  const token = params.token as string;

  const [tokenState, setTokenState] = useState<TokenState>("loading");
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [step, setStep] = useState<WizardStep>("contact");
  const [contactData, setContactData] = useState<ContactData | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch(`/api/public/v/${token}/meta`);
        if (!res.ok) {
          const err = await res.json();
          if (err.error?.code === "TOKEN_EXPIRED") {
            setTokenState("expired");
          } else {
            setTokenState("invalid");
          }
          return;
        }
        const json = await res.json();
        setProject(json.data.project);
        setTokenState("valid");
      } catch {
        setTokenState("invalid");
      }
    }
    loadMeta();
  }, [token]);

  async function handleSubmit(contact: ContactData, property: PropertyData) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/public/v/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contact,
          ...property,
          currency: project?.currency ?? "AED",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Submission failed");
      }

      const json = await res.json();
      setResult(json.data);
      setStep("results");
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (tokenState === "loading") return <WizardSkeleton />;
  if (tokenState === "invalid") return <TokenInvalidCard type="invalid" />;
  if (tokenState === "expired") return <TokenInvalidCard type="expired" />;
  if (!project) return <TokenInvalidCard type="invalid" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0B1F3B] text-white py-4 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">IST Real Estate</h1>
          <p className="text-sm text-white/70 mt-0.5">{project.name}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">

        {/* Progress */}
        {step !== "results" && (
          <WizardProgress
            steps={[
              { key: "contact", label: "Your Info" },
              { key: "property", label: "Property" },
              { key: "results", label: "Results" },
            ]}
            currentStep={step}
            className="mb-8"
          />
        )}

        {/* Steps */}
        {step === "contact" && (
          <ContactStep
            onNext={(data) => {
              setContactData(data);
              setStep("property");
            }}
          />
        )}

        {step === "property" && contactData && (
          <PropertyStep
            project={project}
            onBack={() => setStep("contact")}
            onSubmit={async (data: PropertyData) => {
              setPropertyData(data);
              await handleSubmit(contactData, data);
            }}
            isSubmitting={isSubmitting}
          />
        )}

        {step === "results" && result && propertyData && (
          <ResultsStep
            result={result}
            property={propertyData}
            projectName={project.name}
            currency={project.currency ?? "AED"}
          />
        )}
      </main>
    </div>
  );
}
