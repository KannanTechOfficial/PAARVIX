/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, OnInit, ElementRef, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CollegeService, CollegeAnalytics } from '../../../core/services/college.service';
import * as echarts from 'echarts';

@Component({
  selector: 'pvx-college-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="pvx-analytics-page">
      <!-- Breadcrumb & Top Bar -->
      <div class="pvx-top-bar">
        <div class="pvx-breadcrumb">
          <a routerLink="/dashboards" class="pvx-link">📊 Dashboards</a>
          <span class="pvx-sep">/</span>
          <span class="pvx-current">College & Department Analytics</span>
        </div>
        <div class="pvx-actions">
          <a routerLink="/dashboards/student-portfolio" class="pvx-btn-primary">
            🪪 View Student Portfolio
          </a>
        </div>
      </div>

      @if (analytics(); as a) {
        <!-- Executive KPI Banner -->
        <div class="pvx-exec-banner">
          <div class="pvx-inst-info">
            <span class="pvx-campus-pill">🏛️ {{ a.institution.campus }}</span>
            <h2>{{ a.institution.name }}</h2>
            <p>{{ a.institution.academicYear }} • Executive & HOD Observability Portal</p>
          </div>

          <div class="pvx-exec-kpis">
            <div class="pvx-kpi-card">
              <span class="lbl">TOTAL STUDENTS</span>
              <span class="val text-blue">{{ a.institution.totalStudents.toLocaleString() }}</span>
              <span class="sub">{{ a.departmentStats.length }} Departments</span>
            </div>
            <div class="pvx-kpi-card">
              <span class="lbl">AVG ATTENDANCE</span>
              <span class="val text-green">{{ a.institution.overallAttendance }}%</span>
              <span class="sub">Bio-Punch Verified</span>
            </div>
            <div class="pvx-kpi-card">
              <span class="lbl">OVERALL PASS RATE</span>
              <span class="val text-teal">{{ a.institution.overallPassRate }}%</span>
              <span class="sub">Nov & Apr Semesters</span>
            </div>
            <div class="pvx-kpi-card">
              <span class="lbl">PLACEMENT RATE</span>
              <span class="val text-orange">{{ a.institution.overallPlacementRate }}%</span>
              <span class="sub">Tier-1 & Core Offers</span>
            </div>
          </div>
        </div>

        <!-- Charts Row: Department Comparison & Grade Distribution -->
        <div class="pvx-grid-charts">
          <div class="pvx-card chart-card">
            <div class="pvx-card-header">
              <div>
                <h3>📊 Department Performance Comparison</h3>
                <p class="text-muted">Attendance vs Pass Percentage across Departments</p>
              </div>
            </div>
            <div #deptChart class="pvx-chart-container"></div>
          </div>

          <div class="pvx-card chart-card">
            <div class="pvx-card-header">
              <div>
                <h3>🎯 Campus-Wide Grade Distribution</h3>
                <p class="text-muted">Outcome based education grade spread</p>
              </div>
            </div>
            <div #gradeChart class="pvx-chart-container"></div>
          </div>
        </div>

        <!-- Attendance Defaulters Radar (< 75%) -->
        <div class="pvx-card mt-4">
          <div class="pvx-card-header-flex">
            <div>
              <h3>⚠️ Real-Time Attendance Defaulters Radar</h3>
              <p class="text-muted">Students with &lt; 75% attendance requiring immediate condonation or mentor review</p>
            </div>
            <span class="pvx-badge-defaulter">{{ a.defaulters.length }} Students at Risk</span>
          </div>

          <div class="pvx-table-responsive">
            <table class="pvx-table">
              <thead>
                <tr>
                  <th>Reg No</th>
                  <th>Student Name</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th>Attendance</th>
                  <th>Days Absent</th>
                  <th>Faculty Mentor</th>
                  <th>Parent Contact</th>
                </tr>
              </thead>
              <tbody>
                @for (d of a.defaulters; track d.regNo) {
                  <tr>
                    <td class="font-mono font-bold">{{ d.regNo }}</td>
                    <td class="font-bold">{{ d.name }}</td>
                    <td><span class="pvx-dept-badge">{{ d.department }}</span></td>
                    <td>{{ d.year }}</td>
                    <td>
                      <span class="pvx-att-pill" [class.danger]="d.attendancePercentage < 70" [class.warning]="d.attendancePercentage >= 70">
                        {{ d.attendancePercentage }}%
                      </span>
                    </td>
                    <td class="text-red font-bold">{{ d.daysAbsent }} days</td>
                    <td>{{ d.mentor }}</td>
                    <td class="font-mono">📞 {{ d.parentPhone }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Department Summary Table & Biometric Hourly Distribution -->
        <div class="pvx-grid-two mt-4">
          <div class="pvx-card">
            <h3>🏫 Department Roster & Staffing</h3>
            <div class="pvx-table-responsive mt-3">
              <table class="pvx-table">
                <thead>
                  <tr>
                    <th>Dept</th>
                    <th>Students</th>
                    <th>Avg Att.</th>
                    <th>Pass %</th>
                    <th>Avg SGPA</th>
                    <th>Faculty</th>
                  </tr>
                </thead>
                <tbody>
                  @for (dept of a.departmentStats; track dept.code) {
                    <tr>
                      <td class="font-bold text-primary">{{ dept.code }}</td>
                      <td>{{ dept.students }}</td>
                      <td class="font-bold">{{ dept.avgAttendance }}%</td>
                      <td class="text-green font-bold">{{ dept.passPercentage }}%</td>
                      <td class="text-teal font-extrabold">{{ dept.avgSgpa }}</td>
                      <td>{{ dept.facultyCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="pvx-card">
            <h3>🕒 Daily Biometric Punch Punctuality</h3>
            <p class="text-muted">Morning Entry Distribution</p>
            <div class="pvx-punch-list mt-3">
              @for (slot of a.hourlyPunchDistribution; track slot.timeSlot) {
                <div class="pvx-punch-item">
                  <div class="pvx-punch-time">
                    <span class="slot">{{ slot.timeSlot }}</span>
                    @if (slot.latePunches > 0) {
                      <span class="late-tag">Late Window</span>
                    } @else {
                      <span class="ontime-tag">On Time</span>
                    }
                  </div>
                  <div class="pvx-punch-bars">
                    <div class="bar-ontime" [style.width.%]="(slot.onTimePunches / 1500) * 100">
                      {{ slot.onTimePunches > 0 ? slot.onTimePunches : '' }}
                    </div>
                    @if (slot.latePunches > 0) {
                      <div class="bar-late" [style.width.%]="(slot.latePunches / 200) * 100">
                        {{ slot.latePunches }} Late
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="pvx-loading-box">
          <span>{{ loadError() || 'Loading College & Department Analytics...' }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .pvx-analytics-page {
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
    .pvx-btn-primary {
      padding: 8px 16px;
      background: var(--pvx-primary);
      color: #fff;
      border: none;
      border-radius: var(--pvx-radius);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Executive Banner */
    .pvx-exec-banner {
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--pvx-shadow);
    }
    .pvx-campus-pill {
      display: inline-block;
      background: rgba(30, 58, 138, 0.1);
      color: #1E3A8A;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .pvx-inst-info h2 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .pvx-inst-info p {
      font-size: 13px;
      color: var(--pvx-text-muted);
      margin: 0;
    }
    .pvx-exec-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--pvx-border);
    }
    .pvx-kpi-card {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    .pvx-kpi-card .lbl { font-size: 11px; font-weight: 700; color: var(--pvx-text-muted); letter-spacing: 0.5px; }
    .pvx-kpi-card .val { font-size: 28px; font-weight: 800; line-height: 1.2; margin: 4px 0; }
    .pvx-kpi-card .sub { font-size: 11px; color: var(--pvx-text-muted); }

    /* Toast */
    .pvx-alert-toast {
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #15803D;
      padding: 12px 18px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-weight: 600;
      animation: fadeIn 0.3s ease;
    }

    /* Charts */
    .pvx-grid-charts {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
    }
    .chart-card {
      display: flex;
      flex-direction: column;
    }
    .pvx-chart-container {
      width: 100%;
      height: 320px;
      margin-top: 12px;
    }

    /* Cards */
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
    .pvx-card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .pvx-badge-defaulter {
      background: rgba(239, 68, 68, 0.15);
      color: #DC2626;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
    }
    .pvx-dept-badge {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .pvx-att-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 12px;
    }
    .pvx-att-pill.danger { background: rgba(239, 68, 68, 0.15); color: #DC2626; }
    .pvx-att-pill.warning { background: rgba(249, 115, 22, 0.15); color: #EA580C; }

    /* Action buttons */
    .pvx-action-buttons {
      display: flex;
      gap: 6px;
      justify-content: center;
    }
    .pvx-btn-whatsapp {
      background: #25D366;
      color: #fff;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .pvx-btn-email {
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      color: var(--pvx-text);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Biometric punches */
    .pvx-punch-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .pvx-punch-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pvx-punch-time {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .pvx-punch-time .slot { font-weight: 600; }
    .ontime-tag { color: #16A34A; font-weight: 600; }
    .late-tag { color: #DC2626; font-weight: 600; }
    .pvx-punch-bars {
      display: flex;
      height: 18px;
      border-radius: 4px;
      overflow: hidden;
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
    }
    .bar-ontime {
      background: #14B8A6;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      padding-left: 6px;
    }
    .bar-late {
      background: #EF4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      padding-left: 6px;
    }

    /* Tables */
    .pvx-table-responsive { overflow-x: auto; }
    .pvx-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .pvx-table th {
      background: var(--pvx-bg);
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: var(--pvx-text-muted);
      border-bottom: 1px solid var(--pvx-border);
    }
    .pvx-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--pvx-border);
      color: var(--pvx-text);
    }

    .mt-4 { margin-top: 24px; }
    .mt-3 { margin-top: 14px; }
    .text-muted { color: var(--pvx-text-muted); font-size: 12px; }
    .text-blue { color: #2563EB; }
    .text-green { color: #16A34A; }
    .text-teal { color: #0D9488; }
    .text-orange { color: #EA580C; }
    .text-red { color: #DC2626; }
    .text-primary { color: var(--pvx-primary); }
    .font-bold { font-weight: 600; }
    .font-extrabold { font-weight: 800; }
    .font-mono { font-family: monospace; }
    .text-center { text-align: center; }
    .pvx-loading-box { text-align: center; padding: 80px; font-size: 18px; color: var(--pvx-text-muted); }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class CollegeAnalyticsComponent implements OnInit {
  private readonly collegeService = inject(CollegeService);

  @ViewChild('deptChart') deptChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('gradeChart') gradeChartRef!: ElementRef<HTMLDivElement>;

  analytics = signal<CollegeAnalytics | null>(null);
  loadError = signal<string>('');

  ngOnInit() {
    this.collegeService.getCollegeAnalytics().subscribe({
      next: (data) => {
        this.analytics.set(data);
        setTimeout(() => this.initCharts(data), 100);
      },
      error: (err) => this.loadError.set(err.error?.message || 'Could not load data'),
    });
  }

  private initCharts(data: CollegeAnalytics) {
    if (this.deptChartRef?.nativeElement) {
      const chart = echarts.init(this.deptChartRef.nativeElement);
      const depts = data.departmentStats.map((d) => d.code);
      const attData = data.departmentStats.map((d) => d.avgAttendance);
      const passData = data.departmentStats.map((d) => d.passPercentage);

      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['Avg Attendance %', 'Pass Rate %'], bottom: 0 },
        grid: { top: 20, right: 20, bottom: 40, left: 40 },
        xAxis: { type: 'category', data: depts },
        yAxis: { type: 'value', min: 70, max: 100 },
        series: [
          {
            name: 'Avg Attendance %',
            type: 'bar',
            data: attData,
            itemStyle: { color: '#1E3A8A', borderRadius: [4, 4, 0, 0] },
          },
          {
            name: 'Pass Rate %',
            type: 'line',
            data: passData,
            itemStyle: { color: '#14B8A6' },
            lineStyle: { width: 3 },
          },
        ],
      });
    }

    if (this.gradeChartRef?.nativeElement) {
      const gradeChart = echarts.init(this.gradeChartRef.nativeElement);
      const pieData = data.gradeDistribution.map((g) => ({
        name: g.grade,
        value: g.count,
      }));

      gradeChart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} students ({d}%)' },
        legend: { orient: 'vertical', left: 'right', top: 'center', textStyle: { fontSize: 11 } },
        series: [
          {
            name: 'Grades',
            type: 'pie',
            radius: ['45%', '75%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 13, fontWeight: 'bold' },
            },
            data: pieData,
            color: ['#7C3AED', '#16A34A', '#2563EB', '#EA580C', '#CA8A04', '#DC2626'],
          },
        ],
      });
    }
  }
}

