#include <windows.h>
#include <gdiplus.h>
#include <string>
#include <vector>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <fstream>
#include <cstdlib> // For getenv
#include <commdlg.h> // For GetSaveFileNameW

#pragma comment (lib,"Gdiplus.lib")
#pragma comment (lib,"Comdlg32.lib")

// --- Data Structures ---

struct Config {
    double hourlyGross = 12.50;
    double hourlyNet = 10.00;
};

struct WorkDay {
    std::string date;
    std::string startTime;
    std::string endTime;
    std::string startDateTime;
    std::string endDateTime;
    std::string duration;
    long long durationMs = 0;
    double grossEarning = 0.0;
    double netEarning = 0.0;
    double hourlyGross = 0.0;
    double hourlyNet = 0.0;
};

struct CurrentSession {
    std::chrono::system_clock::time_point startTime;
    double sessionHourlyGross;
    double sessionHourlyNet;
};

// --- Application State and Logic ---

class AppState {
public:
    bool isWorking = false;
    Config config;
    CurrentSession currentSession;
    std::vector<WorkDay> history;
    std::tm currentViewMonth;

    void saveData();

    void togglePunch() {
        if (isWorking) {
            punchOut();
        } else {
            punchIn();
        }
    }

    void changeMonth(int delta) {
        currentViewMonth.tm_mon += delta;
        std::mktime(&currentViewMonth); // Normalize the date
    }

    std::string formatTime(const std::chrono::system_clock::time_point& tp) {
        std::time_t time = std::chrono::system_clock::to_time_t(tp);
        std::tm local_tm;
        localtime_s(&local_tm, &time);
        std::stringstream ss;
        ss << std::put_time(&local_tm, "%H:%M");
        return ss.str();
    }

    std::string formatDate(const std::chrono::system_clock::time_point& tp) {
        std::time_t time = std::chrono::system_clock::to_time_t(tp);
        std::tm local_tm;
        localtime_s(&local_tm, &time);
        std::stringstream ss;
        ss << std::put_time(&local_tm, "%Y-%m-%d");
        return ss.str();
    }

    std::string formatISO(const std::chrono::system_clock::time_point& tp) {
        std::time_t time = std::chrono::system_clock::to_time_t(tp);
        std::tm local_tm;
        gmtime_s(&local_tm, &time);
        std::stringstream ss;
        ss << std::put_time(&local_tm, "%Y-%m-%dT%H:%M:%SZ");
        return ss.str();
    }

    std::wstring formatDuration(long long ms) {
        long long hours = ms / (1000 * 60 * 60);
        long long minutes = (ms % (1000 * 60 * 60)) / (1000 * 60);
        std::wstringstream wss;
        wss << hours << "h " << std::setw(2) << std::setfill(L'0') << minutes << "m";
        return wss.str();
    }

    void punchIn() {
        isWorking = true;
        currentSession.startTime = std::chrono::system_clock::now();
        currentSession.sessionHourlyGross = config.hourlyGross;
        currentSession.sessionHourlyNet = config.hourlyNet;
        OutputDebugStringW(L"PUNCH IN\n");
    }

    void punchOut() {
        isWorking = false;

        auto endTimePoint = std::chrono::system_clock::now();
        auto durationChrono = endTimePoint - currentSession.startTime;
        long long durationMs = std::chrono::duration_cast<std::chrono::milliseconds>(durationChrono).count();
        double durationHours = durationMs / (1000.0 * 60.0 * 60.0);

        WorkDay day;
        day.date = formatDate(currentSession.startTime);
        day.startTime = formatTime(currentSession.startTime);
        day.endTime = formatTime(endTimePoint);
        day.startDateTime = formatISO(currentSession.startTime);
        day.endDateTime = formatISO(endTimePoint);
        std::wstring wduration = formatDuration(durationMs);
        day.duration = std::string(wduration.begin(), wduration.end());
        day.durationMs = durationMs;
        day.hourlyGross = currentSession.sessionHourlyGross;
        day.hourlyNet = currentSession.sessionHourlyNet;
        day.grossEarning = durationHours * day.hourlyGross;
        day.netEarning = durationHours * day.hourlyNet;

        history.insert(history.begin(), day);

        OutputDebugStringW(L"PUNCH OUT, saving data...\n");
        saveData();
    }

    std::wstring getWorkedDurationString() {
        if (!isWorking) {
            return L"0h 00m";
        }
        auto now = std::chrono::system_clock::now();
        auto duration = now - currentSession.startTime;
        long long ms = std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
        return formatDuration(ms);
    }
};

AppState g_appState;

// --- Data Persistence (Manual CSV-like format) ---

std::string GetDataFilePath() {
    const char* appdata = getenv("APPDATA");
    std::string path;
    if (appdata != NULL) {
        path = std::string(appdata) + "\\TimeTrackerPro";
        CreateDirectoryA(path.c_str(), NULL);
        path += "\\data.txt";
    } else {
        path = "TimeTrackerPro_data.txt";
    }
    return path;
}

void AppState::saveData() {
    std::string path = GetDataFilePath();
    std::ofstream file(path);
    if (!file.is_open()) {
        OutputDebugStringW(L"Failed to open data file for writing.\n");
        return;
    }

    file << "config|" << config.hourlyGross << "|" << config.hourlyNet << "\n";

    for (const auto& day : history) {
        file << "workday|" << day.date << "|" << day.startTime << "|" << day.endTime << "|"
             << day.startDateTime << "|" << day.endDateTime << "|" << day.duration << "|"
             << day.durationMs << "|" << day.grossEarning << "|" << day.netEarning << "|"
             << day.hourlyGross << "|" << day.hourlyNet << "\n";
    }
    OutputDebugStringW(L"Data saved successfully.\n");
}

void loadData() {
    std::string path = GetDataFilePath();
    std::ifstream file(path);
    if (!file.is_open()) {
        OutputDebugStringW(L"No existing data file found. Using defaults.\n");
        return;
    }

    g_appState.history.clear();
    std::string line;
    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string token;
        std::getline(ss, token, '|');

        if (token == "config") {
            std::getline(ss, token, '|'); std::stringstream(token) >> g_appState.config.hourlyGross;
            std::getline(ss, token, '|'); std::stringstream(token) >> g_appState.config.hourlyNet;
        } else if (token == "workday") {
            WorkDay day;
            std::getline(ss, day.date, '|');
            std::getline(ss, day.startTime, '|');
            std::getline(ss, day.endTime, '|');
            std::getline(ss, day.startDateTime, '|');
            std::getline(ss, day.endDateTime, '|');
            std::getline(ss, day.duration, '|');
            std::getline(ss, token, '|'); std::stringstream(token) >> day.durationMs;
            std::getline(ss, token, '|'); std::stringstream(token) >> day.grossEarning;
            std::getline(ss, token, '|'); std::stringstream(token) >> day.netEarning;
            std::getline(ss, token, '|'); std::stringstream(token) >> day.hourlyGross;
            std::getline(ss, token, '|'); std::stringstream(token) >> day.hourlyNet;
            g_appState.history.push_back(day);
        }
    }
    OutputDebugStringW(L"Data loaded successfully.\n");
}

// --- UI Structures and Globals ---

struct UIElement {
    RECT rect;
    std::wstring text;
};

UIElement g_header;
UIElement g_punchButton;
UIElement g_workedTimeLabel;
UIElement g_workedTimeValue;
UIElement g_calendarHeader;
UIElement g_calendarGrid;
UIElement g_monthNavPrev;
UIElement g_monthNavNext;
UIElement g_monthNavDisplay;
UIElement g_exportButton;

enum DayType { Normal, Today, OtherMonth, FullDay, PartialDay };
struct CalendarDay {
    RECT rect;
    int dayNumber;
    DayType type;
    const WorkDay* workDayData = nullptr;
};
std::vector<CalendarDay> g_calendarDays;

// Forward declaration of functions
void generateCalendar(int year, int month);
void OnPaint(HDC hdc, HWND hwnd);
void UpdateLayout(HWND hwnd);
void DrawRoundedRectangle(Gdiplus::Graphics& graphics, Gdiplus::Rect r, Gdiplus::Color color, Gdiplus::REAL radius);

// Timer ID
#define ID_TIMER_UPDATE 1

const char g_szClassName[] = "TimeTrackerProWindowClass";

// Window Procedure
LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
    switch(msg)
    {
        case WM_CREATE:
            {
                loadData();
                auto now = std::chrono::system_clock::now();
                std::time_t time_now = std::chrono::system_clock::to_time_t(now);
                localtime_s(&g_appState.currentViewMonth, &time_now);
                g_appState.currentViewMonth.tm_mday = 1;
                UpdateLayout(hwnd);
                SetTimer(hwnd, ID_TIMER_UPDATE, 1000, NULL);
            }
            break;
        case WM_TIMER:
            if (wParam == ID_TIMER_UPDATE) {
                if (g_appState.isWorking) {
                    InvalidateRect(hwnd, &g_workedTimeValue.rect, FALSE);
                }
            }
            break;
        case WM_SIZE:
            UpdateLayout(hwnd);
            InvalidateRect(hwnd, NULL, FALSE);
            break;
        case WM_LBUTTONDOWN:
        {
            int xPos = LOWORD(lParam);
            int yPos = HIWORD(lParam);
            POINT pt = { xPos, yPos };
            if (PtInRect(&g_punchButton.rect, pt))
            {
                g_appState.togglePunch();
                InvalidateRect(hwnd, NULL, TRUE);
                return 0;
            }
            if (PtInRect(&g_monthNavPrev.rect, pt))
            {
                g_appState.changeMonth(-1);
                UpdateLayout(hwnd);
                InvalidateRect(hwnd, NULL, TRUE);
                return 0;
            }
            if (PtInRect(&g_monthNavNext.rect, pt))
            {
                g_appState.changeMonth(1);
                UpdateLayout(hwnd);
                InvalidateRect(hwnd, NULL, TRUE);
                return 0;
            }
            for (const auto& day : g_calendarDays) {
                if (day.workDayData && PtInRect(&day.rect, pt)) {
                    std::wstringstream wss;
                    wss << L"Détails pour le " << day.workDayData->date.c_str() << L"\n"
                        << L"Durée: " << day.workDayData->duration.c_str() << L"\n"
                        << L"Gains nets: " << day.workDayData->netEarning << L"€";
                    MessageBoxW(hwnd, wss.str().c_str(), L"Détails du jour", MB_OK);
                    return 0;
                }
            }
            if (PtInRect(&g_exportButton.rect, pt))
            {
                wchar_t szFile[260] = { 0 };
                OPENFILENAMEW ofn;
                ZeroMemory(&ofn, sizeof(ofn));
                ofn.lStructSize = sizeof(ofn);
                ofn.hwndOwner = hwnd;
                ofn.lpstrFile = szFile;
                ofn.nMaxFile = sizeof(szFile);
                ofn.lpstrFilter = L"CSV (Comma delimited)\0*.csv\0All Files\0*.*\0";
                ofn.nFilterIndex = 1;
                ofn.lpstrFileTitle = NULL;
                ofn.nMaxFileTitle = 0;
                ofn.lpstrInitialDir = NULL;
                ofn.Flags = OFN_PATHMUSTEXIST | OFN_OVERWRITEPROMPT;
                ofn.lpstrDefExt = L"csv";

                if (GetSaveFileNameW(&ofn) == TRUE)
                {
                    std::stringstream csv_content;
                    csv_content << "Date;Jour;Heure Début;Heure Fin;Durée;Gains Nets (€);Taux Net (€/h);Gains Bruts (€);Taux Brut (€/h)\n";
                    for(const auto& wd : g_appState.history) {
                        csv_content << wd.date << ";" << "N/A" << ";" << wd.startTime << ";" << wd.endTime << ";"
                                    << wd.duration << ";" << wd.netEarning << ";" << wd.hourlyNet << ";"
                                    << wd.grossEarning << ";" << wd.hourlyGross << "\n";
                    }

                    std::ofstream outFile(ofn.lpstrFile);
                    if(outFile.is_open()){
                        outFile << csv_content.str();
                        outFile.close();
                        MessageBoxW(hwnd, L"Exportation réussie !", L"Succès", MB_OK);
                    } else {
                        MessageBoxW(hwnd, L"Erreur lors de l'exportation.", L"Erreur", MB_OK);
                    }
                }
                return 0;
            }
        }
        break;
        case WM_PAINT:
        {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            OnPaint(hdc, hwnd);
            EndPaint(hwnd, &ps);
        }
        break;
        case WM_CLOSE:
            DestroyWindow(hwnd);
        break;
        case WM_DESTROY:
            PostQuitMessage(0);
        break;
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int nCmdShow)
{
    Gdiplus::GdiplusStartupInput gdiplusStartupInput;
    ULONG_PTR gdiplusToken;
    Gdiplus::GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, NULL);

    WNDCLASSEX wc;
    HWND hwnd;
    MSG Msg;

    wc.cbSize        = sizeof(WNDCLASSEX);
    wc.style         = 0;
    wc.lpfnWndProc   = WndProc;
    wc.cbClsExtra    = 0;
    wc.cbWndExtra    = 0;
    wc.hInstance     = hInstance;
    wc.hIcon         = LoadIcon(NULL, IDI_APPLICATION);
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = NULL;
    wc.lpszMenuName  = NULL;
    wc.lpszClassName = g_szClassName;
    wc.hIconSm       = LoadIcon(NULL, IDI_APPLICATION);

    if(!RegisterClassEx(&wc))
    {
        MessageBox(NULL, "Window Registration Failed!", "Error!", MB_ICONEXCLAMATION | MB_OK);
        return 0;
    }

    hwnd = CreateWindowEx(
        0,
        g_szClassName,
        "TimeTracker Pro",
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 450, 800,
        NULL, NULL, hInstance, NULL);

    if(hwnd == NULL)
    {
        MessageBox(NULL, "Window Creation Failed!", "Error!", MB_ICONEXCLAMATION | MB_OK);
        return 0;
    }

    ShowWindow(hwnd, nCmdShow);
    UpdateWindow(hwnd);

    while(GetMessage(&Msg, NULL, 0, 0) > 0)
    {
        TranslateMessage(&Msg);
        DispatchMessage(&Msg);
    }

    Gdiplus::GdiplusShutdown(gdiplusToken);
    return (int)Msg.wParam;
}

void UpdateLayout(HWND hwnd) {
    RECT rc;
    GetClientRect(hwnd, &rc);
    int width = rc.right - rc.left;

    g_header.rect = { 20, 20, width - 20, 80 };
    g_header.text = L"⏰ TimeTracker Pro";

    int buttonHeight = 70;
    int buttonY = 180;
    g_punchButton.rect = { 40, buttonY, width - 40, buttonY + buttonHeight };

    int statsY = buttonY + buttonHeight + 40;
    g_workedTimeLabel.rect = { 40, statsY, width / 2, statsY + 30 };
    g_workedTimeLabel.text = L"⏱️ Temps travaillé :";
    g_workedTimeValue.rect = { width / 2, statsY, width - 40, statsY + 30 };

    int monthNavY = statsY + 60;
    g_monthNavPrev.rect = {20, monthNavY, 60, monthNavY + 30};
    g_monthNavPrev.text = L"◀️";
    g_monthNavNext.rect = {width - 60, monthNavY, width - 20, monthNavY + 30};
    g_monthNavNext.text = L"▶️";
    g_monthNavDisplay.rect = {60, monthNavY, width - 60, monthNavY + 30};

    int calendarY = monthNavY + 40;
    g_calendarHeader.rect = { 20, calendarY, width - 20, calendarY + 20 };
    g_calendarGrid.rect = { 20, calendarY + 20, width - 20, calendarY + 20 + (width - 40) };

    int exportY = g_calendarGrid.rect.bottom + 20;
    g_exportButton.rect = { 40, exportY, width - 40, exportY + 40 };
    g_exportButton.text = L"📤 Export CSV Complet";

    generateCalendar(g_appState.currentViewMonth.tm_year + 1900, g_appState.currentViewMonth.tm_mon + 1);
}

void OnPaint(HDC hdc, HWND hwnd)
{
    RECT rc;
    GetClientRect(hwnd, &rc);
    Gdiplus::Rect clientRect(rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top);

    Gdiplus::Bitmap buffer(clientRect.Width, clientRect.Height);
    Gdiplus::Graphics bufferGraphics(&buffer);

    bufferGraphics.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    bufferGraphics.SetTextRenderingHint(Gdiplus::TextRenderingHintAntiAlias);

    Gdiplus::LinearGradientBrush gradBrush(
        Gdiplus::Point(clientRect.GetLeft(), clientRect.GetTop()),
        Gdiplus::Point(clientRect.GetRight(), clientRect.GetBottom()),
        Gdiplus::Color(255, 43, 46, 74),
        Gdiplus::Color(255, 28, 29, 44)
    );
    bufferGraphics.FillRectangle(&gradBrush, clientRect);

    Gdiplus::FontFamily fontFamily(L"Segoe UI");
    Gdiplus::SolidBrush whiteBrush(Gdiplus::Color(255, 240, 240, 240));

    Gdiplus::Font headerFont(&fontFamily, 24, Gdiplus::FontStyleBold, Gdiplus::UnitPixel);
    Gdiplus::StringFormat strFormat;
    strFormat.SetAlignment(Gdiplus::StringAlignmentCenter);
    strFormat.SetLineAlignment(Gdiplus::StringAlignmentCenter);
    Gdiplus::RectF headerRect((Gdiplus::REAL)g_header.rect.left, (Gdiplus::REAL)g_header.rect.top, (Gdiplus::REAL)(g_header.rect.right - g_header.rect.left), (Gdiplus::REAL)(g_header.rect.bottom - g_header.rect.top));
    bufferGraphics.DrawString(g_header.text.c_str(), -1, &headerFont, headerRect, &strFormat, &whiteBrush);

    Gdiplus::Rect buttonRect(g_punchButton.rect.left, g_punchButton.rect.top, g_punchButton.rect.right - g_punchButton.rect.left, g_punchButton.rect.bottom - g_punchButton.rect.top);

    if (g_appState.isWorking) {
        DrawRoundedRectangle(bufferGraphics, buttonRect, Gdiplus::Color(255, 244, 67, 54), 10.0f);
        g_punchButton.text = L"🔴 Pointer Sortie";
    } else {
        DrawRoundedRectangle(bufferGraphics, buttonRect, Gdiplus::Color(255, 76, 175, 80), 10.0f);
        g_punchButton.text = L"🟢 Pointer Entrée";
    }

    Gdiplus::Font buttonFont(&fontFamily, 18, Gdiplus::FontStyleBold, Gdiplus::UnitPixel);
    Gdiplus::RectF buttonTextRect(static_cast<Gdiplus::REAL>(buttonRect.X), static_cast<Gdiplus::REAL>(buttonRect.Y), static_cast<Gdiplus::REAL>(buttonRect.Width), static_cast<Gdiplus::REAL>(buttonRect.Height));
    bufferGraphics.DrawString(g_punchButton.text.c_str(), -1, &buttonFont, buttonTextRect, &strFormat, &whiteBrush);

    Gdiplus::Font statsFont(&fontFamily, 16, Gdiplus::FontStyleRegular, Gdiplus::UnitPixel);
    Gdiplus::SolidBrush grayBrush(Gdiplus::Color(255, 204, 204, 204));

    Gdiplus::StringFormat labelFormat;
    labelFormat.SetAlignment(Gdiplus::StringAlignmentNear);
    labelFormat.SetLineAlignment(Gdiplus::StringAlignmentCenter);
    Gdiplus::RectF workedTimeLabelRect((Gdiplus::REAL)g_workedTimeLabel.rect.left, (Gdiplus::REAL)g_workedTimeLabel.rect.top, (Gdiplus::REAL)(g_workedTimeLabel.rect.right - g_workedTimeLabel.rect.left), (Gdiplus::REAL)(g_workedTimeLabel.rect.bottom - g_workedTimeLabel.rect.top));
    bufferGraphics.DrawString(g_workedTimeLabel.text.c_str(), -1, &statsFont, workedTimeLabelRect, &labelFormat, &grayBrush);

    Gdiplus::StringFormat valueFormat;
    valueFormat.SetAlignment(Gdiplus::StringAlignmentFar);
    valueFormat.SetLineAlignment(Gdiplus::StringAlignmentCenter);
    g_workedTimeValue.text = g_appState.getWorkedDurationString();
    Gdiplus::RectF workedTimeValueRect((Gdiplus::REAL)g_workedTimeValue.rect.left, (Gdiplus::REAL)g_workedTimeValue.rect.top, (Gdiplus::REAL)(g_workedTimeValue.rect.right - g_workedTimeValue.rect.left), (Gdiplus::REAL)(g_workedTimeValue.rect.bottom - g_workedTimeValue.rect.top));
    bufferGraphics.DrawString(g_workedTimeValue.text.c_str(), -1, &statsFont, workedTimeValueRect, &valueFormat, &whiteBrush);

    // --- Draw Month Navigation ---
    bufferGraphics.DrawString(g_monthNavPrev.text.c_str(), -1, &buttonFont, Gdiplus::RectF((Gdiplus::REAL)g_monthNavPrev.rect.left, (Gdiplus::REAL)g_monthNavPrev.rect.top, (Gdiplus::REAL)(g_monthNavPrev.rect.right - g_monthNavPrev.rect.left), (Gdiplus::REAL)(g_monthNavPrev.rect.bottom - g_monthNavPrev.rect.top)), &strFormat, &whiteBrush);
    bufferGraphics.DrawString(g_monthNavNext.text.c_str(), -1, &buttonFont, Gdiplus::RectF((Gdiplus::REAL)g_monthNavNext.rect.left, (Gdiplus::REAL)g_monthNavNext.rect.top, (Gdiplus::REAL)(g_monthNavNext.rect.right - g_monthNavNext.rect.left), (Gdiplus::REAL)(g_monthNavNext.rect.bottom - g_monthNavNext.rect.top)), &strFormat, &whiteBrush);

    wchar_t monthBuffer[100];
    wcsftime(monthBuffer, 100, L"%B %Y", &g_appState.currentViewMonth);
    g_monthNavDisplay.text = monthBuffer;
    bufferGraphics.DrawString(g_monthNavDisplay.text.c_str(), -1, &statsFont, Gdiplus::RectF((Gdiplus::REAL)g_monthNavDisplay.rect.left, (Gdiplus::REAL)g_monthNavDisplay.rect.top, (Gdiplus::REAL)(g_monthNavDisplay.rect.right - g_monthNavDisplay.rect.left), (Gdiplus::REAL)(g_monthNavDisplay.rect.bottom - g_monthNavDisplay.rect.top)), &strFormat, &whiteBrush);


    // --- Draw Calendar ---
    Gdiplus::Font calendarFont(&fontFamily, 14, Gdiplus::FontStyleRegular, Gdiplus::UnitPixel);
    const wchar_t* weekdays[] = {L"L", L"M", L"M", L"J", L"V", L"S", L"D"};
    int dayWidth = (g_calendarHeader.rect.right - g_calendarHeader.rect.left) / 7;
    for (int i = 0; i < 7; ++i) {
        Gdiplus::RectF weekdayRect((Gdiplus::REAL)(g_calendarHeader.rect.left + i * dayWidth), (Gdiplus::REAL)g_calendarHeader.rect.top, (Gdiplus::REAL)dayWidth, (Gdiplus::REAL)(g_calendarHeader.rect.bottom - g_calendarHeader.rect.top));
        bufferGraphics.DrawString(weekdays[i], -1, &calendarFont, weekdayRect, &strFormat, &grayBrush);
    }

    for (const auto& day : g_calendarDays) {
        Gdiplus::SolidBrush dayBrush(Gdiplus::Color(255, 0, 0, 0));
        switch (day.type) {
            case DayType::Normal:     dayBrush.SetColor(Gdiplus::Color(0, 0, 0, 0)); break;
            case DayType::Today:      dayBrush.SetColor(Gdiplus::Color(255, 33, 150, 243)); break;
            case DayType::OtherMonth: break;
            case DayType::FullDay:    dayBrush.SetColor(Gdiplus::Color(255, 76, 175, 80)); break;
            case DayType::PartialDay: dayBrush.SetColor(Gdiplus::Color(255, 255, 152, 0)); break;
        }

        if (day.type != DayType::OtherMonth) {
             bufferGraphics.FillEllipse(&dayBrush, static_cast<INT>(day.rect.left), static_cast<INT>(day.rect.top), static_cast<INT>(day.rect.right - day.rect.left), static_cast<INT>(day.rect.bottom - day.rect.top));
        }

        Gdiplus::RectF dayTextRect((Gdiplus::REAL)day.rect.left, (Gdiplus::REAL)day.rect.top, (Gdiplus::REAL)(day.rect.right - day.rect.left), (Gdiplus::REAL)(day.rect.bottom - day.rect.top));
        Gdiplus::SolidBrush& textColor = (day.type == DayType::OtherMonth) ? grayBrush : whiteBrush;
        if (day.dayNumber > 0) {
            bufferGraphics.DrawString(std::to_wstring(day.dayNumber).c_str(), -1, &calendarFont, dayTextRect, &strFormat, &textColor);
        }
    }

    // Draw Export Button
    Gdiplus::Rect exportButtonRect(g_exportButton.rect.left, g_exportButton.rect.top, g_exportButton.rect.right - g_exportButton.rect.left, g_exportButton.rect.bottom - g_exportButton.rect.top);
    DrawRoundedRectangle(bufferGraphics, exportButtonRect, Gdiplus::Color(255, 100, 100, 100), 5.0f);
    bufferGraphics.DrawString(g_exportButton.text.c_str(), -1, &statsFont, Gdiplus::RectF((Gdiplus::REAL)exportButtonRect.X, (Gdiplus::REAL)exportButtonRect.Y, (Gdiplus::REAL)exportButtonRect.Width, (Gdiplus::REAL)exportButtonRect.Height), &strFormat, &whiteBrush);

    Gdiplus::Graphics graphics(hdc);
    graphics.DrawImage(&buffer, 0, 0);
}

void DrawRoundedRectangle(Gdiplus::Graphics& graphics, Gdiplus::Rect r, Gdiplus::Color color, Gdiplus::REAL radius)
{
    using Gdiplus::REAL;
    Gdiplus::GraphicsPath path;
    REAL d = radius * 2;
    path.AddArc(static_cast<REAL>(r.X), static_cast<REAL>(r.Y), d, d, 180, 90);
    path.AddArc(static_cast<REAL>(r.GetRight()) - d, static_cast<REAL>(r.Y), d, d, 270, 90);
    path.AddArc(static_cast<REAL>(r.GetRight()) - d, static_cast<REAL>(r.GetBottom()) - d, d, d, 0, 90);
    path.AddArc(static_cast<REAL>(r.X), static_cast<REAL>(r.GetBottom()) - d, d, d, 90, 90);
    path.CloseFigure();

    Gdiplus::SolidBrush brush(color);
    graphics.FillPath(&brush, &path);
}

void generateCalendar(int year, int month) {
    g_calendarDays.clear();

    std::tm first_day_tm = {};
    first_day_tm.tm_year = year - 1900;
    first_day_tm.tm_mon = month - 1;
    first_day_tm.tm_mday = 1;
    std::mktime(&first_day_tm);

    int weekday_start = (first_day_tm.tm_wday == 0) ? 6 : first_day_tm.tm_wday - 1;

    int days_in_month = 31;
    if (month == 4 || month == 6 || month == 9 || month == 11) {
        days_in_month = 30;
    } else if (month == 2) {
        bool is_leap = (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
        days_in_month = is_leap ? 29 : 28;
    }

    int day_size = (g_calendarGrid.rect.right - g_calendarGrid.rect.left) / 7;

    int current_day = 1;
    for (int row = 0; row < 6; ++row) {
        for (int col = 0; col < 7; ++col) {
            if ((row == 0 && col < weekday_start) || current_day > days_in_month) {
                // empty day cell
            } else {
                CalendarDay day;
                day.rect = {g_calendarGrid.rect.left + col * day_size, g_calendarGrid.rect.top + row * day_size, g_calendarGrid.rect.left + (col + 1) * day_size, g_calendarGrid.rect.top + (row + 1) * day_size};
                day.dayNumber = current_day;

                auto now = std::chrono::system_clock::now();
                std::time_t time_now = std::chrono::system_clock::to_time_t(now);
                std::tm local_tm_now;
                localtime_s(&local_tm_now, &time_now);

                if (current_day == local_tm_now.tm_mday && month == (local_tm_now.tm_mon + 1) && year == (local_tm_now.tm_year + 1900)) {
                    day.type = DayType::Today;
                } else {
                    day.type = DayType::Normal;
                }

                std::stringstream ss;
                ss << year << "-" << std::setw(2) << std::setfill('0') << month << "-" << std::setw(2) << std::setfill('0') << current_day;
                std::string date_str = ss.str();

                for(const auto& wd : g_appState.history) {
                    if (wd.date == date_str) {
                        day.workDayData = &wd;
                        if (wd.durationMs >= 7 * 3600 * 1000) {
                            day.type = DayType::FullDay;
                        } else {
                            day.type = DayType::PartialDay;
                        }
                        break;
                    }
                }
                g_calendarDays.push_back(day);
                current_day++;
            }
        }
    }
}
