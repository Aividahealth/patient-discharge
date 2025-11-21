/**
 * Common renderer for AI-simplified discharge summary and instructions
 * Provides standardized, optimized display across all portals
 */

import React from 'react';
import {
  parseDischargeSummary,
  parseDischargeInstructions,
  type ParsedDischargeSummary,
  type ParsedDischargeInstructions,
} from '@/lib/simplified-discharge-parser';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SimplifiedDischargeSummaryProps {
  content: string;
  className?: string;
}

interface SimplifiedDischargeInstructionsProps {
  content: string;
  className?: string;
}

/**
 * Render discharge summary (Overview section)
 */
export const SimplifiedDischargeSummary: React.FC<SimplifiedDischargeSummaryProps> = ({
  content,
  className = '',
}) => {
  const parsed = parseDischargeSummary(content);

  // If parsing failed, render raw content
  if (parsed.raw && !parsed.reasonsForStay && !parsed.whatHappened) {
    return (
      <div className={className}>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">
          {parsed.raw}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {parsed.reasonsForStay && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            Reasons for Hospital Stay
          </h3>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {parsed.reasonsForStay}
          </div>
        </div>
      )}

      {parsed.whatHappened && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            What Happened During Your Stay
          </h3>
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {parsed.whatHappened}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Render discharge instructions
 */
export const SimplifiedDischargeInstructions: React.FC<SimplifiedDischargeInstructionsProps> = ({
  content,
  className = '',
}) => {
  const parsed = parseDischargeInstructions(content);

  // If parsing failed, render raw content
  if (parsed.raw && !parsed.medications && !parsed.appointments && !parsed.dietActivity && !parsed.warningSigns) {
    return (
      <div className={className}>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">
          {parsed.raw}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Medications Section */}
      {parsed.medications && parsed.medications.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            Your Medications
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Medicine Name</TableHead>
                  <TableHead className="font-semibold">Frequency</TableHead>
                  <TableHead className="font-semibold">When to Take</TableHead>
                  <TableHead className="font-semibold">Special Instructions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.medications.map((med, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{med.medicineName || '-'}</TableCell>
                    <TableCell>{med.frequency || '-'}</TableCell>
                    <TableCell>{med.whenToTake || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {med.specialInstructions || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Appointments Section */}
      {parsed.appointments && parsed.appointments.length > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            Upcoming Appointments
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
            {parsed.appointments.map((appt, index) => (
              <li key={index} className="leading-relaxed">
                {appt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diet & Activity Section */}
      {parsed.dietActivity && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            Diet & Activity
          </h3>
          <div className="space-y-4">
            {parsed.dietActivity.foodsToInclude && parsed.dietActivity.foodsToInclude.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Foods to Include
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.dietActivity.foodsToInclude.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.dietActivity.foodsToLimit && parsed.dietActivity.foodsToLimit.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Foods to Limit
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.dietActivity.foodsToLimit.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.dietActivity.recommendedActivities && parsed.dietActivity.recommendedActivities.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Recommended Activities
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.dietActivity.recommendedActivities.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.dietActivity.activitiesToAvoid && parsed.dietActivity.activitiesToAvoid.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Activities to Avoid
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.dietActivity.activitiesToAvoid.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warning Signs Section */}
      {parsed.warningSigns && (
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">
            Warning Signs
          </h3>
          <div className="space-y-4">
            {parsed.warningSigns.call911 && parsed.warningSigns.call911.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-red-600">
                  When to Seek Help - Call 911
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.warningSigns.call911.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.warningSigns.callDoctor && parsed.warningSigns.callDoctor.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-orange-600">
                  When to Call Your Doctor
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.warningSigns.callDoctor.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.warningSigns.emergencyContacts && parsed.warningSigns.emergencyContacts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Emergency Contacts
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                  {parsed.warningSigns.emergencyContacts.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Section-specific renderers for tabs
 */
export const MedicationsSection: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const parsed = parseDischargeInstructions(content);
  if (!parsed.medications || parsed.medications.length === 0) {
    return (
      <div className={className}>
        <p className="text-muted-foreground">No medication information available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Medicine Name</TableHead>
              <TableHead className="font-semibold">Frequency</TableHead>
              <TableHead className="font-semibold">When to Take</TableHead>
              <TableHead className="font-semibold">Special Instructions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsed.medications.map((med, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{med.medicineName || '-'}</TableCell>
                <TableCell>{med.frequency || '-'}</TableCell>
                <TableCell>{med.whenToTake || '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {med.specialInstructions || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export const AppointmentsSection: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const parsed = parseDischargeInstructions(content);
  if (!parsed.appointments || parsed.appointments.length === 0) {
    return (
      <div className={className}>
        <p className="text-muted-foreground">No appointment information available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
        {parsed.appointments.map((appt, index) => (
          <li key={index} className="leading-relaxed">
            {appt}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DietActivitySection: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const parsed = parseDischargeInstructions(content);
  if (!parsed.dietActivity) {
    return (
      <div className={className}>
        <p className="text-muted-foreground">No diet & activity information available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {parsed.dietActivity.foodsToInclude && parsed.dietActivity.foodsToInclude.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Foods to Include
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.dietActivity.foodsToInclude.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.dietActivity.foodsToLimit && parsed.dietActivity.foodsToLimit.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Foods to Limit
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.dietActivity.foodsToLimit.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.dietActivity.recommendedActivities && parsed.dietActivity.recommendedActivities.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Recommended Activities
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.dietActivity.recommendedActivities.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.dietActivity.activitiesToAvoid && parsed.dietActivity.activitiesToAvoid.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Activities to Avoid
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.dietActivity.activitiesToAvoid.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const WarningSignsSection: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const parsed = parseDischargeInstructions(content);
  if (!parsed.warningSigns) {
    return (
      <div className={className}>
        <p className="text-muted-foreground">No warning signs information available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {parsed.warningSigns.call911 && parsed.warningSigns.call911.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-red-600">
            When to Seek Help - Call 911
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.warningSigns.call911.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.warningSigns.callDoctor && parsed.warningSigns.callDoctor.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-orange-600">
            When to Call Your Doctor
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.warningSigns.callDoctor.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.warningSigns.emergencyContacts && parsed.warningSigns.emergencyContacts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">
            Emergency Contacts
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
            {parsed.warningSigns.emergencyContacts.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Combined renderer for both summary and instructions
 */
interface SimplifiedDischargeContentProps {
  summary?: string;
  instructions?: string;
  className?: string;
}

export const SimplifiedDischargeContent: React.FC<SimplifiedDischargeContentProps> = ({
  summary,
  instructions,
  className = '',
}) => {
  return (
    <div className={`space-y-8 ${className}`}>
      {summary && (
        <div>
          <SimplifiedDischargeSummary content={summary} />
        </div>
      )}
      {instructions && (
        <div>
          <SimplifiedDischargeInstructions content={instructions} />
        </div>
      )}
    </div>
  );
};

