# Makefile for TimeTracker Pro

# Compiler
CXX = x86_64-w64-mingw32-g++

# Compiler flags
CXXFLAGS = -Wall -Wextra -std=c++17 -g

# Linker flags
# Added -lcomdlg32 for the Save As dialog
LDFLAGS = -luser32 -lgdi32 -lgdiplus -lkernel32 -lshell32 -lcomdlg32

# Target executable
TARGET = TimeTrackerPro.exe

# Source files
SRCS = main.cpp

# Object files
OBJS = $(SRCS:.cpp=.o)

# Default rule
all: $(TARGET)

# Rule to link the executable
$(TARGET): $(OBJS)
	$(CXX) $(OBJS) -o $(TARGET) $(LDFLAGS)

# Rule to compile source files into object files
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Clean rule
clean:
	rm -f $(OBJS) $(TARGET)

# Phony targets
.PHONY: all clean
