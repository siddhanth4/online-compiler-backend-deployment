#include <iostream>
#include <vector>
#include <algorithm> // For std::lower_bound

// Function to perform binary search using lower_bound
int binary_search(const std::vector<int>& arr, int val, int start, int end) {
    // Use lower_bound to find the first position where 'val' can be inserted
    auto it = std::lower_bound(arr.begin() + start, arr.begin() + end + 1, val);
    return it - arr.begin(); // Return the index
}

// Function to perform insertion sort
std::vector<int> insertion_sort(std::vector<int> arr) {
    for (size_t i = 1; i < arr.size(); i++) {
        int val = arr[i];
        int j = binary_search(arr, val, 0, i - 1); // Find the position to insert
        // Insert 'val' into the correct position
        arr.insert(arr.begin() + j, val);
        arr.erase(arr.begin() + i + 1); // Remove the old position of 'val'
    }
    return arr;
}

int main() {
    std::vector<int> arr = {37, 23, 0, 17, 12, 72, 31, 46, 100, 88, 54, 555};

    std::cout << "Sorted array:\n";
    std::vector<int> sorted_arr = insertion_sort(arr);
    for (const auto& num : sorted_arr) {
        std::cout << num << " ";
    }
    std::cout << std::endl;

    return 0;
}
