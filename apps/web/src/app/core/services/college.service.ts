/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StudentProfile {
  name: string;
  regNo: string;
  status: 'ACTIVE' | 'INACTIVE';
  degree: string;
  batch: string;
  mentor: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  aadhaar: string;
  fatherName: string;
  motherName: string;
  contactNumber: string;
  officialMail: string;
  permanentAddress: string;
  campus: string;
  todayBiometric: {
    inTime: string;
    outTime: string;
    status: string;
    feed: string;
  };
  attendanceSummary: {
    workingDays: number;
    totalHours: number;
    presentHours: number;
    odHours: number;
    odPlusPresent: number;
    percentage: number;
    status: 'ELIGIBLE' | 'CONDONATION' | 'DETAINED';
    formula: string;
  };
  attendanceLog: Array<{
    date: string;
    inTime: string;
    outTime: string;
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    h5: string;
    h6: string;
    h7: string;
  }>;
  todayTimeline: Array<{
    hour: number;
    courseCode?: string;
    courseName: string;
    handledBy: string;
    time: string;
    isCurrent?: boolean;
  }>;
  gradeReports: Record<
    string,
    {
      session: string;
      totalPapers: number;
      clearedPapers: number;
      sgpa: number;
      standingArrears: number;
      courses: Array<{
        semester: string;
        courseCode: string;
        courseName: string;
        credits: number;
        grade: string;
      }>;
    }
  >;
  onDutyHistory: Array<{
    id: string;
    period: string;
    purpose: string;
    appliedOn: string;
    mentorApproved: string;
    hodApproved: string;
    status: string;
  }>;
  internalMarksRatio: Array<{
    subCode: string;
    subName: string;
    type: 'T' | 'P' | 'C' | 'E' | 'NC';
    credit: number;
    cat1: string;
    cat2: string;
    fat1: string;
    fat2: string;
    sas: string;
    rev1: string;
    rev2: string;
    rev3: string;
    labExpr: string;
    labModel: string;
    internal: string;
    external: string;
  }>;
  disciplinaryRecords: Array<{
    date: string;
    activityName: string;
    mentorRemarks: string;
    hodRemarks: string;
    status: string;
  }>;
}

export interface CollegeAnalytics {
  institution: {
    name: string;
    campus: string;
    academicYear: string;
    totalStudents: number;
    totalFaculty: number;
    overallAttendance: number;
    overallPassRate: number;
    overallPlacementRate: number;
  };
  departmentStats: Array<{
    code: string;
    name: string;
    students: number;
    avgAttendance: number;
    passPercentage: number;
    avgSgpa: number;
    facultyCount: number;
    defaultersCount: number;
  }>;
  gradeDistribution: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
  hourlyPunchDistribution: Array<{
    timeSlot: string;
    onTimePunches: number;
    latePunches: number;
  }>;
  defaulters: Array<{
    regNo: string;
    name: string;
    department: string;
    year: string;
    attendancePercentage: number;
    daysAbsent: number;
    mentor: string;
    parentPhone: string;
    alertStatus: 'Alert Sent' | 'Pending';
  }>;
}

@Injectable({ providedIn: 'root' })
export class CollegeService {
  private readonly http = inject(HttpClient);

  getStudentPortfolio(regNo?: string): Observable<StudentProfile> {
    const url = regNo ? `/api/college/student/${regNo}` : `/api/college/student`;
    return this.http.get<StudentProfile>(url);
  }

  getCollegeAnalytics(): Observable<CollegeAnalytics> {
    return this.http.get<CollegeAnalytics>('/api/college/analytics');
  }
}

