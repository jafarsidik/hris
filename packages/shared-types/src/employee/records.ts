import type { PageParams } from '../common/pagination';

/** Employee read shows up on every record summary. */
export interface RecordEmployeeRead {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
}

/** An emergency contact. */
export interface EmployeeContactSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A family member; flagged rows are dependents. */
export interface EmployeeFamilyMemberSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly fullName: string;
  readonly relationship: string;
  readonly birthDate: string | null;
  readonly occupation: string | null;
  readonly isDependent: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An education history entry. */
export interface EmployeeEducationSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly level: string;
  readonly institution: string;
  readonly major: string | null;
  readonly startYear: number;
  readonly endYear: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A previous employment entry. */
export interface EmployeeExperienceSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly companyName: string;
  readonly positionTitle: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A skill with proficiency. */
export interface EmployeeSkillSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly name: string;
  readonly proficiency: string;
  readonly yearsOfExperience: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A professional certification. */
export interface EmployeeCertificationSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly name: string;
  readonly issuer: string;
  readonly issueDate: string;
  readonly expiryDate: string | null;
  readonly credentialId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** An HR document attached to an employee. */
export interface EmployeeDocumentSummary extends RecordEmployeeRead {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly fileUrl: string | null;
  readonly expiryDate: string | null;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateEmployeeContactInput {
  readonly employeeId: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly isPrimary: boolean;
}

export interface UpdateEmployeeContactInput {
  readonly name?: string;
  readonly relationship?: string;
  readonly phone?: string;
  readonly email?: string | null;
  readonly address?: string | null;
  readonly isPrimary?: boolean;
}

export interface CreateEmployeeFamilyMemberInput {
  readonly employeeId: string;
  readonly fullName: string;
  readonly relationship: string;
  readonly birthDate: string | null;
  readonly occupation: string | null;
  readonly isDependent: boolean;
}

export interface UpdateEmployeeFamilyMemberInput {
  readonly fullName?: string;
  readonly relationship?: string;
  readonly birthDate?: string | null;
  readonly occupation?: string | null;
  readonly isDependent?: boolean;
}

export interface CreateEmployeeEducationInput {
  readonly employeeId: string;
  readonly level: string;
  readonly institution: string;
  readonly major: string | null;
  readonly startYear: number;
  readonly endYear: number | null;
}

export interface UpdateEmployeeEducationInput {
  readonly level?: string;
  readonly institution?: string;
  readonly major?: string | null;
  readonly startYear?: number;
  readonly endYear?: number | null;
}

export interface CreateEmployeeExperienceInput {
  readonly employeeId: string;
  readonly companyName: string;
  readonly positionTitle: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly description: string | null;
}

export interface UpdateEmployeeExperienceInput {
  readonly companyName?: string;
  readonly positionTitle?: string;
  readonly startDate?: string;
  readonly endDate?: string | null;
  readonly description?: string | null;
}

export interface CreateEmployeeSkillInput {
  readonly employeeId: string;
  readonly name: string;
  readonly proficiency: string;
  readonly yearsOfExperience: number | null;
}

export interface UpdateEmployeeSkillInput {
  readonly name?: string;
  readonly proficiency?: string;
  readonly yearsOfExperience?: number | null;
}

export interface CreateEmployeeCertificationInput {
  readonly employeeId: string;
  readonly name: string;
  readonly issuer: string;
  readonly issueDate: string;
  readonly expiryDate: string | null;
  readonly credentialId: string | null;
}

export interface UpdateEmployeeCertificationInput {
  readonly name?: string;
  readonly issuer?: string;
  readonly issueDate?: string;
  readonly expiryDate?: string | null;
  readonly credentialId?: string | null;
}

export interface CreateEmployeeDocumentInput {
  readonly employeeId: string;
  readonly title: string;
  readonly category: string;
  readonly fileUrl: string | null;
  readonly expiryDate: string | null;
  readonly note: string | null;
}

export interface UpdateEmployeeDocumentInput {
  readonly title?: string;
  readonly category?: string;
  readonly fileUrl?: string | null;
  readonly expiryDate?: string | null;
  readonly note?: string | null;
}

export interface EmployeeRecordQuery {
  readonly employeeId?: string;
  readonly search?: string;
  readonly page?: PageParams;
}
