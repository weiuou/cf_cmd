#include<iostream>
#include<vector>
#include<string>
using namespace std;
int main()
{
    //test23
    int t;
    cin>>t;
    while(t--)
    {
        int n;
        cin>>n;
        vector<string>s(2);
        cin>>s[0]>>s[1];
        string ans = "";
        int mx = n-1,mn=0;
        for(int i=n-1;i>=1;i--){
            if(s[0][i]=='1'&&s[1][i-1]=='0')mx = i-1;
        }
        for(int i=0;i<mx;i++){
            if(s[0][i+1]=='0'&&s[1][i]=='1')mn = i+1;
        }
        for(int i=0;i<=mx;i++)cout<<s[0][i];
        for(int i=mx;i<n;i++)cout<<s[1][i];
        cout<<endl<<(mx-mn+1)<<endl;
    }
}