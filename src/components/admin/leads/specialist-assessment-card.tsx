"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { UserCheck, PlusCircle, Pencil } from "lucide-react";
import { AddSpecialistAssessmentDialog } from "./add-specialist-assessment-dialog";

interface SpecialistAssessment {
  id: string;
  estimatedPrice: number | string;
  estimatedPsf: number | string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  specialist: {
    id: string;
    name: string;
    email: string;
  };
}

interface Props {
  leadId: string;
  areaSqft: number;
  assessment: SpecialistAssessment | null;
}

export function SpecialistAssessmentCard({ leadId, areaSqft, assessment }: Props) {
  const [current, setCurrent] = useState<SpecialistAssessment | null>(assessment);
  const [dialogOpen, setDialogOpen] = useState(false);

  const SQM_TO_SQFT = 10.7639;
  const psf = current ? Number(current.estimatedPsf) : 0;
  const psfSqm = Math.round(psf * SQM_TO_SQFT).toLocaleString();

  return (
    <>
      <Card className="border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-base">Specialist Assessment</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDialogOpen(true)}
            >
              {current ? (
                <>
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </>
              ) : (
                <>
                  <PlusCircle className="h-3 w-3 mr-1" />
                  Add Assessment
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Sales specialist&apos;s market study and opinion
          </p>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="space-y-4">
              {/* Estimated Price */}
              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
                  Specialist Estimate
                </div>
                <div className="text-2xl font-bold text-amber-700">
                  {formatCurrency(Number(current.estimatedPrice))}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(psf).toLocaleString()} AED/sqft · {psfSqm} AED/sqm
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Assessment Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed">
                  {current.notes}
                </p>
              </div>

              {/* Meta */}
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>By {current.specialist.name}</span>
                <span>{new Date(current.updatedAt).toLocaleDateString("en-AE")}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <UserCheck className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500">No Assessment Yet</p>
              <p className="text-xs text-gray-400 mt-1">
                A specialist can add their market opinion with supporting notes.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setDialogOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Add Assessment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddSpecialistAssessmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leadId={leadId}
        areaSqft={areaSqft}
        existing={current}
        onSaved={(saved) => {
          setCurrent(saved);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
