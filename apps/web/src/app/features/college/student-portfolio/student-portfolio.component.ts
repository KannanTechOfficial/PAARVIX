/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CollegeService, StudentProfile } from '../../../core/services/college.service';

@Component({
  selector: 'pvx-student-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="pvx-portfolio-page">
      <!-- Breadcrumb & Top Bar -->
      <div class="pvx-top-bar">
        <div class="pvx-breadcrumb">
          <a routerLink="/dashboards" class="pvx-link">📊 Dashboards</a>
          <span class="pvx-sep">/</span>
          <span class="pvx-current">Student Portfolio</span>
        </div>
        <div class="pvx-actions">
          <a routerLink="/dashboards/college-analytics" class="pvx-btn-secondary">
            🏫 College Analytics
          </a>
          <button (click)="printPage()" class="pvx-btn-outline">
            🖨️ Export PDF
          </button>
        </div>
      </div>

      @if (student(); as s) {
        <!-- 1. Student ID Header Card -->
        <div class="pvx-id-card">
          <div class="pvx-id-header">
            <div class="pvx-avatar-section">
              <div class="pvx-avatar">
                <span>KV</span>
              </div>
              <div class="pvx-name-details">
                <div class="pvx-name-row">
                  <h1>{{ s.name }}</h1>
                  <span class="pvx-badge-active">● {{ s.status }}</span>
                  <span class="pvx-campus-tag">🏫 {{ s.campus }}</span>
                </div>
                <div class="pvx-reg-row">
                  <span class="pvx-reg-chip">🪪 REG NO: <strong>{{ s.regNo }}</strong></span>
                  <span class="pvx-meta-chip">🎓 {{ s.degree }}</span>
                  <span class="pvx-meta-chip">📅 BATCH {{ s.batch }}</span>
                  <span class="pvx-meta-chip">👨‍🏫 MENTOR: <strong>{{ s.mentor }}</strong></span>
                </div>
              </div>
            </div>

            <!-- Today's Biometric Log -->
            <div class="pvx-biometric-box">
              <div class="pvx-bio-header">
                <span class="pvx-pulse-dot"></span>
                <span class="pvx-bio-title">Today's Biometric Log</span>
              </div>
              <div class="pvx-bio-times">
                <div class="pvx-bio-time-item">
                  <span class="pvx-bio-label">IN TIME</span>
                  <span class="pvx-bio-val text-green">🕒 {{ s.todayBiometric.inTime }}</span>
                </div>
                <div class="pvx-bio-divider"></div>
                <div class="pvx-bio-time-item">
                  <span class="pvx-bio-label">OUT TIME</span>
                  <span class="pvx-bio-val text-blue">🕒 {{ s.todayBiometric.outTime }}</span>
                </div>
              </div>
              <div class="pvx-bio-feed">{{ s.todayBiometric.feed }}</div>
            </div>
          </div>

          <!-- Quick Navigation Tabs -->
          <div class="pvx-tabs">
            <button
              [class.active]="activeTab() === 'overview'"
              (click)="activeTab.set('overview')">
              👤 Academic & Profile
            </button>
            <button
              [class.active]="activeTab() === 'attendance'"
              (click)="activeTab.set('attendance')">
              📊 Bio-Attendance Feed ({{ s.attendanceSummary.percentage }}%)
            </button>
            <button
              [class.active]="activeTab() === 'timetable'"
              (click)="activeTab.set('timetable')">
              ⏱️ Today's Schedule
            </button>
            <button
              [class.active]="activeTab() === 'grades'"
              (click)="activeTab.set('grades')">
              🎓 Semester Grades & SGPA
            </button>
            <button
              [class.active]="activeTab() === 'internals'"
              (click)="activeTab.set('internals')">
              📑 Internal Marks Ratio
            </button>
            <button
              [class.active]="activeTab() === 'od'"
              (click)="activeTab.set('od')">
              📜 On-Duty (OD) & Arrears
            </button>
          </div>
        </div>

        <!-- TAB 1: ACADEMIC & PROFILE DETAILS -->
        @if (activeTab() === 'overview') {
          <div class="pvx-tab-content">
            <div class="pvx-grid-two">
              <div class="pvx-card">
                <h3>📋 Academic Details</h3>
                <div class="pvx-details-list">
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">DEGREE & COURSE</span>
                    <span class="pvx-detail-value">{{ s.degree }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">BATCH YEAR</span>
                    <span class="pvx-detail-value">{{ s.batch }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">FACULTY MENTOR</span>
                    <span class="pvx-detail-value">{{ s.mentor }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">OFFICIAL EMAIL</span>
                    <span class="pvx-detail-value text-primary">{{ s.officialMail }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">STUDENT ID STATUS</span>
                    <span class="pvx-badge-success">ACTIVE IN DIRECTORY</span>
                  </div>
                </div>
              </div>

              <div class="pvx-card">
                <h3>👤 Personal Information</h3>
                <div class="pvx-details-list">
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">DATE OF BIRTH</span>
                    <span class="pvx-detail-value">{{ s.dob }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">GENDER</span>
                    <span class="pvx-detail-value">{{ s.gender === 'M' ? 'Male (M)' : 'Female (F)' }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">BLOOD GROUP</span>
                    <span class="pvx-detail-value text-red">🩸 {{ s.bloodGroup }}</span>
                  </div>
                  <div class="pvx-detail-item">
                    <span class="pvx-detail-label">AADHAAR NUMBER</span>
                    <span class="pvx-detail-value">XXXX-XXXX-{{ s.aadhaar.slice(-4) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="pvx-card mt-4">
              <h3>👨‍👩‍👦 Family & Contact Records</h3>
              <div class="pvx-grid-three">
                <div class="pvx-detail-item">
                  <span class="pvx-detail-label">FATHER'S NAME</span>
                  <span class="pvx-detail-value font-bold">{{ s.fatherName }}</span>
                </div>
                <div class="pvx-detail-item">
                  <span class="pvx-detail-label">MOTHER'S NAME</span>
                  <span class="pvx-detail-value font-bold">{{ s.motherName }}</span>
                </div>
                <div class="pvx-detail-item">
                  <span class="pvx-detail-label">CONTACT NUMBER</span>
                  <span class="pvx-detail-value font-bold text-teal">📞 {{ s.contactNumber }}</span>
                </div>
              </div>
              <div class="pvx-detail-item mt-3">
                <span class="pvx-detail-label">PERMANENT ADDRESS</span>
                <span class="pvx-detail-value">{{ s.permanentAddress }}</span>
              </div>
            </div>
          </div>
        }

        <!-- TAB 2: BIO-ATTENDANCE FEED & LOG -->
        @if (activeTab() === 'attendance') {
          <div class="pvx-tab-content">
            <!-- Attendance Summary KPIs -->
            <div class="pvx-card pvx-att-summary-card">
              <div class="pvx-card-header-flex">
                <div>
                  <h3>📊 Semester Bio-Attendance Summary</h3>
                  <p class="pvx-formula-note">💡 Formula: <code>{{ s.attendanceSummary.formula }}</code></p>
                </div>
                <div class="pvx-eligibility-badge" [class.eligible]="s.attendanceSummary.status === 'ELIGIBLE'">
                  <span class="pvx-elig-label">ATTENDANCE STATUS</span>
                  <span class="pvx-elig-val">🎯 {{ s.attendanceSummary.percentage }}% — {{ s.attendanceSummary.status }}</span>
                </div>
              </div>

              <div class="pvx-kpi-grid">
                <div class="pvx-kpi-box">
                  <span class="pvx-kpi-icon">📅</span>
                  <span class="pvx-kpi-num">{{ s.attendanceSummary.workingDays }}</span>
                  <span class="pvx-kpi-lbl">Working Days</span>
                  <span class="pvx-kpi-sub">Total Active Days</span>
                </div>
                <div class="pvx-kpi-box">
                  <span class="pvx-kpi-icon">⏳</span>
                  <span class="pvx-kpi-num">{{ s.attendanceSummary.totalHours }}</span>
                  <span class="pvx-kpi-lbl">Total Hours</span>
                  <span class="pvx-kpi-sub">Scheduled Hours</span>
                </div>
                <div class="pvx-kpi-box">
                  <span class="pvx-kpi-icon">✅</span>
                  <span class="pvx-kpi-num text-green">{{ s.attendanceSummary.presentHours }}</span>
                  <span class="pvx-kpi-lbl">Present Hours</span>
                  <span class="pvx-kpi-sub">Regular Class Hours</span>
                </div>
                <div class="pvx-kpi-box">
                  <span class="pvx-kpi-icon">🏅</span>
                  <span class="pvx-kpi-num text-orange">{{ s.attendanceSummary.odHours }}</span>
                  <span class="pvx-kpi-lbl">On Duty (OD)</span>
                  <span class="pvx-kpi-sub">Approved OD Hours</span>
                </div>
                <div class="pvx-kpi-box highlight">
                  <span class="pvx-kpi-icon">🎯</span>
                  <span class="pvx-kpi-num text-teal">{{ s.attendanceSummary.odPlusPresent }}</span>
                  <span class="pvx-kpi-lbl">OD + Present</span>
                  <span class="pvx-kpi-sub">Total Credited Hours</span>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="pvx-progress-wrap">
                <div class="pvx-progress-bar">
                  <div class="pvx-progress-fill" [style.width.%]="s.attendanceSummary.percentage"></div>
                  <div class="pvx-threshold-line" title="75% Minimum Eligibility Threshold" style="left: 75%;"></div>
                </div>
                <div class="pvx-progress-labels">
                  <span>0%</span>
                  <span class="pvx-threshold-text">75% Min. Required</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <!-- Hour-wise Attendance Log -->
            <div class="pvx-card mt-4">
              <div class="pvx-card-header-flex">
                <div>
                  <h3>📅 Student Attendance Log</h3>
                  <p class="text-muted">Full Semester Biometric & Hour-wise Class Feed</p>
                </div>
                <div class="pvx-legend">
                  <span class="pvx-legend-item"><span class="badge p">P</span> Present</span>
                  <span class="pvx-legend-item"><span class="badge a">A</span> Absent</span>
                  <span class="pvx-legend-item"><span class="badge od">OD</span> On Duty</span>
                  <span class="pvx-legend-item"><span class="badge dash">-</span> Free / Recess</span>
                </div>
              </div>

              <div class="pvx-table-responsive">
                <table class="pvx-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>In Time</th>
                      <th>Out Time</th>
                      <th class="text-center">H1</th>
                      <th class="text-center">H2</th>
                      <th class="text-center">H3</th>
                      <th class="text-center">H4</th>
                      <th class="text-center">H5</th>
                      <th class="text-center">H6</th>
                      <th class="text-center">H7</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of s.attendanceLog; track row.date) {
                      <tr>
                        <td class="font-bold">{{ row.date }}</td>
                        <td class="font-mono text-green">{{ row.inTime }}</td>
                        <td class="font-mono text-blue">{{ row.outTime }}</td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h1)">{{ row.h1 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h2)">{{ row.h2 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h3)">{{ row.h3 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h4)">{{ row.h4 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h5)">{{ row.h5 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h6)">{{ row.h6 }}</span></td>
                        <td class="text-center"><span class="badge" [ngClass]="getBadgeClass(row.h7)">{{ row.h7 }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

        <!-- TAB 3: TIMETABLE & LIVE SCHEDULE -->
        @if (activeTab() === 'timetable') {
          <div class="pvx-tab-content">
            <div class="pvx-card">
              <div class="pvx-card-header-flex">
                <div>
                  <h3>⏱️ Today's Class Timeline</h3>
                  <p class="text-muted">Today's schedule</p>
                </div>
                <span class="pvx-badge-live">● LIVE CLASS SESSION</span>
              </div>

              <div class="pvx-timeline-list">
                @for (item of s.todayTimeline; track item.hour) {
                  <div class="pvx-timeline-item" [class.current-hour]="item.isCurrent">
                    <div class="pvx-time-badge">
                      <span class="pvx-hour-num">Hour {{ item.hour }}</span>
                      <span class="pvx-hour-time">{{ item.time }}</span>
                    </div>
                    <div class="pvx-timeline-content">
                      <div class="pvx-course-title">
                        📚 {{ item.courseName }}
                        @if (item.courseCode) {
                          <span class="pvx-code-badge">{{ item.courseCode }}</span>
                        }
                        @if (item.isCurrent) {
                          <span class="pvx-now-badge">Happening Now</span>
                        }
                      </div>
                      <div class="pvx-faculty-name">
                        👨‍🏫 Handled by: <strong>{{ item.handledBy }}</strong>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- TAB 4: GRADES & SGPA -->
        @if (activeTab() === 'grades') {
          <div class="pvx-tab-content">
            <!-- Session Selector & Arrears Status -->
            <div class="pvx-grade-header-row">
              <div class="pvx-card flex-1">
                <div class="pvx-session-picker">
                  <span class="pvx-label-bold">Academic Session:</span>
                  <div class="pvx-pill-group">
                    @for (sess of availableSessions(); track sess) {
                      <button
                        [class.active]="selectedSession() === sess"
                        (click)="selectedSession.set(sess)">
                        {{ sess }}
                      </button>
                    }
                  </div>
                </div>

                @if (currentGradeReport(); as gr) {
                  <div class="pvx-grade-stats-bar">
                    <div class="pvx-stat-item">
                      <span class="lbl">Total Papers</span>
                      <span class="val">{{ gr.totalPapers }}</span>
                    </div>
                    <div class="pvx-stat-item">
                      <span class="lbl">Cleared</span>
                      <span class="val text-green">✓ {{ gr.clearedPapers }}</span>
                    </div>
                    <div class="pvx-stat-item">
                      <span class="lbl">SGPA</span>
                      <span class="val text-teal font-extrabold">{{ gr.sgpa }}</span>
                    </div>
                    <div class="pvx-stat-item">
                      <span class="lbl">Arrears</span>
                      <span class="val text-green">0</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Standing Arrears Banner Card -->
              <div class="pvx-card pvx-arrears-banner">
                <div class="pvx-arrears-icon">🎉</div>
                <div class="pvx-arrears-info">
                  <h4>✓ ZERO STANDING ARREARS</h4>
                  <p>All Clear! Outstanding academic performance across all evaluated semesters.</p>
                </div>
              </div>
            </div>

            <!-- Grade Details Table -->
            @if (currentGradeReport(); as gr) {
              <div class="pvx-card mt-4">
                <div class="pvx-card-header-flex">
                  <h3>🎓 Semester Grade Report — {{ gr.session }}</h3>
                  <span class="pvx-badge-success">All {{ gr.totalPapers }} Subjects Passed</span>
                </div>

                <div class="pvx-table-responsive">
                  <table class="pvx-table">
                    <thead>
                      <tr>
                        <th>Semester</th>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th class="text-center">Credits</th>
                        <th class="text-center">Grade</th>
                        <th>Performance Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of gr.courses; track c.courseCode) {
                        <tr>
                          <td>{{ c.semester }}</td>
                          <td class="font-mono font-bold">{{ c.courseCode }}</td>
                          <td>{{ c.courseName }}</td>
                          <td class="text-center">{{ c.credits }}</td>
                          <td class="text-center">
                            <span class="pvx-grade-pill" [ngClass]="getGradeClass(c.grade)">
                              {{ c.grade }}
                            </span>
                          </td>
                          <td>{{ getGradeTier(c.grade) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- TAB 5: INTERNAL MARKS RATIO -->
        @if (activeTab() === 'internals') {
          <div class="pvx-tab-content">
            <div class="pvx-card">
              <div class="pvx-card-header-flex">
                <div>
                  <h3>📊 Internal Mark Calculation Ratio</h3>
                  <p class="text-muted">Academic Portal Evaluation Matrix & Continuous Assessment Breakdown</p>
                </div>
                <span class="pvx-campus-tag">Odd Semester 2026-27</span>
              </div>

              <div class="pvx-table-responsive">
                <table class="pvx-table table-condensed">
                  <thead>
                    <tr>
                      <th>Sub Code</th>
                      <th>Sub Name</th>
                      <th>Type</th>
                      <th>Cr</th>
                      <th>CAT I</th>
                      <th>CAT II</th>
                      <th>FAT I</th>
                      <th>FAT II</th>
                      <th>SAS</th>
                      <th>REV I</th>
                      <th>REV II</th>
                      <th>REV III</th>
                      <th>Lab Exp</th>
                      <th>Lab Mod</th>
                      <th>Internal</th>
                      <th>External</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of s.internalMarksRatio; track row.subCode) {
                      <tr>
                        <td class="font-mono font-bold text-teal">{{ row.subCode }}</td>
                        <td class="font-medium">{{ row.subName }}</td>
                        <td><span class="badge sub-type">{{ row.type }}</span></td>
                        <td>{{ row.credit }}</td>
                        <td class="font-mono">{{ row.cat1 }}</td>
                        <td class="font-mono">{{ row.cat2 }}</td>
                        <td class="font-mono">{{ row.fat1 }}</td>
                        <td class="font-mono">{{ row.fat2 }}</td>
                        <td class="font-mono text-green">{{ row.sas }}</td>
                        <td class="text-center font-bold">{{ row.rev1 }}</td>
                        <td class="text-center font-bold">{{ row.rev2 }}</td>
                        <td class="text-center font-bold">{{ row.rev3 }}</td>
                        <td class="font-mono">{{ row.labExpr }}</td>
                        <td class="font-mono">{{ row.labModel }}</td>
                        <td class="font-bold text-teal">{{ row.internal }}</td>
                        <td class="font-mono text-muted">{{ row.external }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

        <!-- TAB 6: ON-DUTY (OD) & DISCIPLINARY -->
        @if (activeTab() === 'od') {
          <div class="pvx-tab-content">
            <div class="pvx-card">
              <h3>📜 On-Duty (OD) Application History</h3>
              <p class="text-muted mb-3">Student Hackathons, Competitions & Industrial Visits</p>

              <div class="pvx-table-responsive">
                <table class="pvx-table">
                  <thead>
                    <tr>
                      <th>OD Period</th>
                      <th>Purpose & Event Details</th>
                      <th>Applied On</th>
                      <th>Mentor Approved</th>
                      <th>HOD Approved</th>
                      <th>Final Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (od of s.onDutyHistory; track od.id) {
                      <tr>
                        <td class="font-mono font-bold">{{ od.period }}</td>
                        <td>{{ od.purpose }}</td>
                        <td>{{ od.appliedOn }}</td>
                        <td class="text-green">{{ od.mentorApproved }}</td>
                        <td class="text-green">{{ od.hodApproved }}</td>
                        <td>
                          <span class="pvx-badge-success">{{ od.status }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Disciplinary Activity Card -->
            <div class="pvx-card mt-4 pvx-clean-record-card">
              <div class="pvx-clean-icon">🛡️</div>
              <div>
                <h3>⚠️ Student Disciplinary Activities</h3>
                <p class="text-green font-bold">No disciplinary records found. 100% Clean Conduct Record! 🎉</p>
                <span class="text-muted text-sm">Verified by Faculty Mentor & Department Head</span>
              </div>
            </div>
          </div>
        }
      } @else {
        <div class="pvx-loading-box">
          <span>{{ loadError() || 'Loading Student Portfolio...' }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .pvx-portfolio-page {
      max-width: 1300px;
      margin: 0 auto;
      padding-bottom: 48px;
    }
    .pvx-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .pvx-breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .pvx-link { color: var(--pvx-primary); text-decoration: none; font-weight: 500; }
    .pvx-link:hover { text-decoration: underline; }
    .pvx-sep { color: var(--pvx-text-muted); }
    .pvx-current { color: var(--pvx-text); font-weight: 600; }
    .pvx-actions { display: flex; gap: 10px; }
    .pvx-btn-secondary {
      padding: 8px 14px;
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      border-radius: var(--pvx-radius);
      color: var(--pvx-text);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .pvx-btn-secondary:hover { background: var(--pvx-bg); }
    .pvx-btn-outline {
      padding: 8px 14px;
      background: transparent;
      border: 1px solid var(--pvx-border);
      border-radius: var(--pvx-radius);
      color: var(--pvx-text);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    /* ID Card Header */
    .pvx-id-card {
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--pvx-shadow);
    }
    .pvx-id-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .pvx-avatar-section {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .pvx-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1E3A8A, #14B8A6);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
    }
    .pvx-name-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .pvx-name-row h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .pvx-badge-active {
      background: rgba(34, 197, 94, 0.15);
      color: #16A34A;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
    }
    .pvx-campus-tag {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      color: var(--pvx-text-muted);
    }
    .pvx-reg-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .pvx-reg-chip {
      background: rgba(30, 58, 138, 0.1);
      color: #1E3A8A;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
    }
    .pvx-meta-chip {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: var(--pvx-text);
    }

    /* Biometric Log Box */
    .pvx-biometric-box {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      border-radius: 10px;
      padding: 16px 20px;
      min-width: 280px;
    }
    .pvx-bio-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .pvx-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #14B8A6;
      box-shadow: 0 0 8px #14B8A6;
    }
    .pvx-bio-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--pvx-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pvx-bio-times {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pvx-bio-time-item {
      display: flex;
      flex-direction: column;
    }
    .pvx-bio-label {
      font-size: 10px;
      color: var(--pvx-text-muted);
      font-weight: 600;
    }
    .pvx-bio-val {
      font-size: 14px;
      font-weight: 700;
      font-family: monospace;
    }
    .pvx-bio-divider {
      width: 1px;
      height: 28px;
      background: var(--pvx-border);
    }
    .pvx-bio-feed {
      margin-top: 8px;
      font-size: 11px;
      color: var(--pvx-text-muted);
      text-align: center;
    }

    /* Navigation Tabs */
    .pvx-tabs {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      border-top: 1px solid var(--pvx-border);
      padding-top: 16px;
      overflow-x: auto;
    }
    .pvx-tabs button {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--pvx-text-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .pvx-tabs button:hover {
      color: var(--pvx-text);
      background: var(--pvx-bg);
    }
    .pvx-tabs button.active {
      background: var(--pvx-primary);
      color: #fff;
    }

    /* Cards & Grids */
    .pvx-card {
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      border-radius: 12px;
      padding: 24px;
      box-shadow: var(--pvx-shadow);
    }
    .pvx-grid-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .pvx-grid-three {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .pvx-details-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .pvx-detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pvx-detail-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--pvx-text-muted);
      letter-spacing: 0.5px;
    }
    .pvx-detail-value {
      font-size: 14px;
      color: var(--pvx-text);
    }

    /* Attendance Summary */
    .pvx-card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }
    .pvx-formula-note {
      font-size: 12px;
      color: var(--pvx-text-muted);
      margin-top: 4px;
    }
    .pvx-formula-note code {
      background: var(--pvx-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    .pvx-eligibility-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 8px 16px;
      border-radius: 8px;
    }
    .pvx-elig-label { font-size: 10px; font-weight: 700; color: #16A34A; }
    .pvx-elig-val { font-size: 16px; font-weight: 800; color: #15803D; }

    .pvx-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .pvx-kpi-box {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .pvx-kpi-box.highlight {
      border-color: #14B8A6;
      background: rgba(20, 184, 166, 0.05);
    }
    .pvx-kpi-icon { font-size: 24px; margin-bottom: 6px; }
    .pvx-kpi-num { font-size: 26px; font-weight: 800; line-height: 1.1; }
    .pvx-kpi-lbl { font-size: 12px; font-weight: 600; color: var(--pvx-text); margin-top: 4px; }
    .pvx-kpi-sub { font-size: 10px; color: var(--pvx-text-muted); }

    /* Progress bar */
    .pvx-progress-wrap { margin-top: 12px; }
    .pvx-progress-bar {
      position: relative;
      height: 12px;
      background: var(--pvx-bg);
      border-radius: 6px;
      overflow: visible;
      border: 1px solid var(--pvx-border);
    }
    .pvx-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #14B8A6, #22C55E);
      border-radius: 5px;
    }
    .pvx-threshold-line {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 2px;
      background: #EF4444;
      z-index: 2;
    }
    .pvx-progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--pvx-text-muted);
      margin-top: 6px;
    }
    .pvx-threshold-text { color: #EF4444; font-weight: 600; }

    /* Tables */
    .pvx-table-responsive { overflow-x: auto; }
    .pvx-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .pvx-table th {
      background: var(--pvx-bg);
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: var(--pvx-text-muted);
      border-bottom: 1px solid var(--pvx-border);
    }
    .pvx-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--pvx-border);
      color: var(--pvx-text);
    }
    .table-condensed th, .table-condensed td { padding: 6px 10px; font-size: 12px; }
    .badge {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge.p { background: rgba(34, 197, 94, 0.15); color: #16A34A; }
    .badge.a { background: rgba(239, 68, 68, 0.15); color: #DC2626; }
    .badge.od { background: rgba(20, 184, 166, 0.15); color: #0D9488; }
    .badge.dash { background: var(--pvx-bg); color: var(--pvx-text-muted); }
    .badge.sub-type { width: auto; padding: 2px 6px; background: var(--pvx-bg); border: 1px solid var(--pvx-border); }

    .pvx-legend { display: flex; gap: 14px; font-size: 12px; }
    .pvx-legend-item { display: flex; align-items: center; gap: 6px; }

    /* Timetable list */
    .pvx-timeline-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .pvx-timeline-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 18px;
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      border-radius: 8px;
    }
    .pvx-timeline-item.current-hour {
      border-color: #14B8A6;
      background: rgba(20, 184, 166, 0.08);
      box-shadow: 0 0 12px rgba(20, 184, 166, 0.2);
    }
    .pvx-time-badge {
      display: flex;
      flex-direction: column;
      min-width: 100px;
    }
    .pvx-hour-num { font-weight: 700; font-size: 14px; color: var(--pvx-primary); }
    .pvx-hour-time { font-size: 11px; color: var(--pvx-text-muted); }
    .pvx-course-title { font-size: 15px; font-weight: 600; color: var(--pvx-text); }
    .pvx-code-badge {
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      margin-left: 8px;
    }
    .pvx-now-badge {
      background: #14B8A6;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 8px;
    }
    .pvx-faculty-name { font-size: 12px; color: var(--pvx-text-muted); margin-top: 4px; }

    /* Grades */
    .pvx-grade-header-row { display: flex; gap: 20px; flex-wrap: wrap; }
    .flex-1 { flex: 1; }
    .pvx-session-picker { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .pvx-label-bold { font-weight: 600; font-size: 13px; }
    .pvx-pill-group button {
      padding: 6px 12px;
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-right: 6px;
    }
    .pvx-pill-group button.active {
      background: var(--pvx-primary);
      color: #fff;
      border-color: var(--pvx-primary);
    }
    .pvx-grade-stats-bar {
      display: flex;
      gap: 24px;
      padding-top: 14px;
      border-top: 1px solid var(--pvx-border);
    }
    .pvx-stat-item .lbl { font-size: 11px; color: var(--pvx-text-muted); display: block; }
    .pvx-stat-item .val { font-size: 20px; font-weight: 800; }

    .pvx-arrears-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(20, 184, 166, 0.1));
      border-color: rgba(34, 197, 94, 0.3);
      max-width: 400px;
    }
    .pvx-arrears-icon { font-size: 36px; }
    .pvx-arrears-info h4 { margin: 0 0 4px 0; color: #15803D; font-size: 16px; font-weight: 700; }
    .pvx-arrears-info p { margin: 0; font-size: 12px; color: var(--pvx-text-muted); }

    .pvx-grade-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 12px;
    }
    .pvx-grade-pill.o { background: rgba(147, 51, 234, 0.15); color: #7C3AED; }
    .pvx-grade-pill.aplus { background: rgba(34, 197, 94, 0.15); color: #16A34A; }
    .pvx-grade-pill.a { background: rgba(59, 130, 246, 0.15); color: #2563EB; }
    .pvx-grade-pill.bplus { background: rgba(249, 115, 22, 0.15); color: #EA580C; }
    .pvx-grade-pill.b { background: rgba(234, 179, 8, 0.15); color: #CA8A04; }

    .pvx-clean-record-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.25);
    }
    .pvx-clean-icon { font-size: 32px; }

    /* Helpers */
    .mt-4 { margin-top: 20px; }
    .mt-3 { margin-top: 12px; }
    .mb-3 { margin-bottom: 12px; }
    .text-green { color: #16A34A; }
    .text-blue { color: #2563EB; }
    .text-teal { color: #0D9488; }
    .text-red { color: #DC2626; }
    .text-orange { color: #EA580C; }
    .text-muted { color: var(--pvx-text-muted); }
    .text-sm { font-size: 12px; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 600; }
    .font-extrabold { font-weight: 800; }
    .font-medium { font-weight: 500; }
    .font-mono { font-family: monospace; }
    .pvx-badge-success { background: rgba(34, 197, 94, 0.15); color: #16A34A; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .pvx-badge-live { background: rgba(239, 68, 68, 0.15); color: #DC2626; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .pvx-loading-box { text-align: center; padding: 80px; font-size: 18px; color: var(--pvx-text-muted); }
  `],
})
export class StudentPortfolioComponent implements OnInit {
  private readonly collegeService = inject(CollegeService);

  student = signal<StudentProfile | null>(null);
  loadError = signal<string>('');
  activeTab = signal<'overview' | 'attendance' | 'timetable' | 'grades' | 'internals' | 'od'>('overview');
  selectedSession = signal<string>('Apr 2026');

  availableSessions = computed(() => {
    const s = this.student();
    return s ? Object.keys(s.gradeReports) : [];
  });

  currentGradeReport = computed(() => {
    const s = this.student();
    if (!s) return null;
    return s.gradeReports[this.selectedSession()] || Object.values(s.gradeReports)[0] || null;
  });

  ngOnInit() {
    this.collegeService.getStudentPortfolio().subscribe({
      next: (data) => {
        this.student.set(data);
        const sessions = Object.keys(data.gradeReports);
        if (sessions.length > 0) {
          this.selectedSession.set(sessions[0]);
        }
      },
      error: (err) => this.loadError.set(err.error?.message || 'Could not load data'),
    });
  }

  getBadgeClass(val: string): string {
    switch (val) {
      case 'P': return 'p';
      case 'A': return 'a';
      case 'OD': return 'od';
      default: return 'dash';
    }
  }

  getGradeClass(grade: string): string {
    switch (grade) {
      case 'O': return 'o';
      case 'A+': return 'aplus';
      case 'A': return 'a';
      case 'B+': return 'bplus';
      case 'B': return 'b';
      default: return '';
    }
  }

  getGradeTier(grade: string): string {
    switch (grade) {
      case 'O': return '🌟 Outstanding (10 Points)';
      case 'A+': return '💎 Excellent (9 Points)';
      case 'A': return '⭐ Very Good (8 Points)';
      case 'B+': return '👍 Good (7 Points)';
      case 'B': return 'Above Average (6 Points)';
      default: return 'Re-Appear';
    }
  }

  printPage() {
    window.print();
  }
}

